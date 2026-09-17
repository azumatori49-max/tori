import { useCallback, useEffect, useState } from 'react';
import { get, onValue, push, ref, set, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { db, storage } from '../lib/firebase';
import { targetForType } from '../data/checkItems';
import type { ReportType, StoreKey, Submission } from '../types';

export const useStoreSubmissionStatus = (
  storeKey: StoreKey | null,
  type: ReportType,
  key: string,
) => {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeKey) {
      setSubmission(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const path = `submissions/${storeKey}/${type}/${key}`;
    const unsub = onValue(
      ref(db, path),
      (snap) => {
        const val = snap.val() as Submission | null;
        setSubmission(val ?? null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [storeKey, type, key]);

  return { submission, loading };
};

/** 認証が切れていたら匿名認証で自動復旧する */
export const ensureAuth = async (): Promise<void> => {
  const auth = getAuth();
  if (auth.currentUser) return;
  await signInAnonymously(auth);
};

/** 一時的な通信エラーは自動リトライ（権限エラーは即時失敗） */
export const withRetry = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String((err as { message?: string })?.message ?? err);
      if (/permission|unauthorized|unauthenticated/i.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 1200 * Math.pow(2, i)));
    }
  }
  throw lastErr;
};

/** アップロード失敗を自動で本部に記録（失敗しても無視） */
const logUploadError = async (info: {
  storeKey: string;
  storeName: string;
  type: string;
  dateOrWeekKey: string;
  message: string;
  uploaded: number;
  total: number;
}): Promise<void> => {
  try {
    await set(push(ref(db, 'errorLogs')), {
      ...info,
      at: new Date().toISOString(),
    });
  } catch {
    // ログ送信自体の失敗は無視
  }
};

const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const ratio = Math.min(maxWidth / img.width, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas context unavailable');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) reject(new Error('compress failed'));
            else resolve(blob);
          },
          'image/jpeg',
          quality,
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });

/** 圧縮に失敗しても、元画像が5MB未満ならそのまま送る */
export const prepareBlob = async (file: File): Promise<{ blob: Blob; type: string }> => {
  try {
    const blob = await compressImage(file);
    return { blob, type: 'image/jpeg' };
  } catch {
    if (file.size <= 4_500_000 && file.type.startsWith('image/')) {
      return { blob: file, type: file.type };
    }
    throw new Error('画像の変換に失敗しました。別の写真でお試しください');
  }
};

export interface SubmitArgs {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  dateOrWeekKey: string;
  files: File[];
  onProgress?: (uploaded: number, total: number) => void;
}

/** @deprecated use targetForType(type, storeKey) from data/checkItems */
export const TARGET_PHOTOS = 7;

const normalisePhotosArray = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return Object.keys(obj)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => obj[k])
      .filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  return [];
};

const normalisePhotosObj = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!raw) return out;
  if (Array.isArray(raw)) {
    raw.forEach((u, i) => {
      if (typeof u === 'string' && u.length > 0) out[String(i)] = u;
    });
    return out;
  }
  if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
      if (typeof v === 'string' && v.length > 0) out[k] = v;
    });
  }
  return out;
};

export const submitPhotos = async ({
  storeKey,
  storeName,
  type,
  dateOrWeekKey,
  files,
  onProgress,
}: SubmitArgs): Promise<string[]> => {
  const total = files.length;
  if (total === 0) throw new Error('no photos selected');

  await ensureAuth();
  const path = `submissions/${storeKey}/${type}/${dateOrWeekKey}`;

  const existingSnap = await get(ref(db, path));
  const existingPhotos = normalisePhotosArray(
    (existingSnap.val() as { photos?: unknown } | null)?.photos,
  );

  const newUrls: string[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const original = files[i];
    if (!original) throw new Error(`photo ${i + 1} is missing`);
    const { blob, type: contentType } = await prepareBlob(original);
    const slot = existingPhotos.length + i;
    const objectPath = `photos/${storeKey}/${type}/${dateOrWeekKey}/${slot}_${Date.now()}.jpg`;
    const ref0 = storageRef(storage, objectPath);
    await withRetry(() => uploadBytes(ref0, blob, { contentType }));
    const url = await withRetry(() => getDownloadURL(ref0));
    if (typeof url !== 'string' || url.length === 0) {
      throw new Error(`download URL missing for photo ${i + 1}`);
    }
    newUrls.push(url);
    onProgress?.(i + 1, total);
  }
  const target = targetForType(type, storeKey);
  const merged = [...existingPhotos, ...newUrls].slice(0, target);

  const photosObj: Record<string, string> = {};
  merged.forEach((u, i) => {
    photosObj[String(i)] = u;
  });

  const submission = {
    count: merged.length,
    submittedAt: new Date().toISOString(),
    photos: photosObj,
    storeName,
  };

  await withRetry(() => set(ref(db, path), submission));
  return merged;
};

export type SubmitSlot =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File }
  | { kind: 'empty' };

export interface SubmitSlotsArgs {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  dateOrWeekKey: string;
  slots: SubmitSlot[];
  onProgress?: (uploaded: number, totalNew: number) => void;
}

export const submitSlots = async ({
  storeKey,
  storeName,
  type,
  dateOrWeekKey,
  slots,
  onProgress,
}: SubmitSlotsArgs): Promise<Record<string, string>> => {
  await ensureAuth();

  const path = `submissions/${storeKey}/${type}/${dateOrWeekKey}`;

  const existingSnap = await withRetry(() => get(ref(db, path)));
  const existing = existingSnap.val() as
    | { photoMeta?: Record<string, { uploadedAt: string }> }
    | null;
  const existingMeta = existing?.photoMeta || {};

  const totalNew = slots.filter((s) => s.kind === 'new').length;
  let uploadedCount = 0;

  const photosObj: Record<string, string> = {};
  const photoMeta: Record<string, { uploadedAt: string }> = {};
  let savedCount = 0;

  for (let i = 0; i < slots.length; i += 1) {
    if (i >= 20) break;
    const slot = slots[i];
    const key = String(i);
    if (slot.kind === 'existing') {
      photosObj[key] = slot.url;
      if (existingMeta[key]) photoMeta[key] = existingMeta[key];
      savedCount += 1;
    } else if (slot.kind === 'new') {
      let url = '';
      try {
        const { blob, type: contentType } = await prepareBlob(slot.file);
        const objectPath = `photos/${storeKey}/${type}/${dateOrWeekKey}/${i}_${Date.now()}.jpg`;
        const ref0 = storageRef(storage, objectPath);
        await withRetry(() => uploadBytes(ref0, blob, { contentType }));
        url = await withRetry(() => getDownloadURL(ref0));
      } catch (err) {
        const done = uploadedCount;
        const msg = err instanceof Error ? err.message : String(err);
        await logUploadError({
          storeKey,
          storeName,
          type,
          dateOrWeekKey,
          message: msg,
          uploaded: done,
          total: totalNew,
        });
        throw new Error(
          `${i + 1}枚目のアップロードに失敗しました（${done}/${totalNew}枚は保存済み）。エラーは自動で本部に報告されました。電波の良い場所でもう一度お試しください。`,
        );
      }
      if (typeof url !== 'string' || url.length === 0) {
        throw new Error(`${i + 1}枚目のURL取得に失敗しました`);
      }
      const meta = { uploadedAt: new Date().toISOString() };
      photosObj[key] = url;
      photoMeta[key] = meta;
      savedCount += 1;
      uploadedCount += 1;

      // 1枚成功するごとに途中保存（失敗してもここまでの分は残る）
      try {
        await update(ref(db, path), {
          count: savedCount,
          submittedAt: meta.uploadedAt,
          storeName,
          [`photos/${key}`]: url,
          [`photoMeta/${key}`]: meta,
        });
      } catch {
        // 途中保存の失敗は無視（最後の一括保存でリカバリー）
      }

      onProgress?.(uploadedCount, totalNew);
    }
  }

  const submission = {
    count: savedCount,
    submittedAt: new Date().toISOString(),
    photos: photosObj,
    storeName,
    photoMeta,
  };

  await withRetry(() => set(ref(db, path), submission));
  return photosObj;
};

export const fetchSubmissionsForKey = async (
  storeKeys: StoreKey[],
  type: ReportType,
  key: string,
): Promise<Record<StoreKey, Submission | null>> => {
  const entries = await Promise.all(
    storeKeys.map(async (storeKey) => {
      try {
        const snap = await get(ref(db, `submissions/${storeKey}/${type}/${key}`));
        return [storeKey, (snap.val() as Submission | null) ?? null] as const;
      } catch {
        return [storeKey, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
};

export const useSubmissionsBulk = (
  storeKeys: StoreKey[],
  type: ReportType,
  key: string,
) => {
  const [data, setData] = useState<Record<StoreKey, Submission | null>>({});
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    if (storeKeys.length === 0) {
      setData({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSubmissionsForKey(storeKeys, type, key)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKeys.join(','), type, key, reloadToken]);

  return { data, loading, reload };
};

export const markAsLineReport = async (
  storeKey: StoreKey,
  storeName: string,
  type: ReportType,
  dateOrWeekKey: string,
): Promise<void> => {
  await ensureAuth();
  const target = targetForType(type, storeKey);
  const path = `submissions/${storeKey}/${type}/${dateOrWeekKey}`;
  const snap = await get(ref(db, path));
  const existing = snap.val() as {
    photos?: unknown;
    photoMeta?: Record<string, { uploadedAt: string }>;
  } | null;
  const photosObj = normalisePhotosObj(existing?.photos);
  const photoMeta = existing?.photoMeta || {};

  await withRetry(() =>
    set(ref(db, path), {
      count: target,
      submittedAt: new Date().toISOString(),
      photos: photosObj,
      storeName,
      viaLine: true,
      photoMeta,
    }),
  );
};

export const unmarkSubmission = async (
  storeKey: StoreKey,
  type: ReportType,
  dateOrWeekKey: string,
): Promise<void> => {
  await ensureAuth();
  const path = `submissions/${storeKey}/${type}/${dateOrWeekKey}`;
  const snap = await get(ref(db, path));
  const existing = snap.val() as {
    photos?: unknown;
    storeName?: string;
    photoMeta?: Record<string, { uploadedAt: string }>;
  } | null;
  const photosObj = normalisePhotosObj(existing?.photos);
  const photoCount = Object.keys(photosObj).length;

  if (photoCount === 0) {
    await withRetry(() => set(ref(db, path), null));
    return;
  }
  await withRetry(() =>
    set(ref(db, path), {
      count: photoCount,
      submittedAt: new Date().toISOString(),
      photos: photosObj,
      storeName: existing?.storeName ?? '',
      photoMeta: existing?.photoMeta || {},
    }),
  );
};

export const moveSubmission = async (
  storeKey: StoreKey,
  type: ReportType,
  fromKey: string,
  toKey: string,
): Promise<void> => {
  if (fromKey === toKey) return;
  await ensureAuth();
  const fromPath = `submissions/${storeKey}/${type}/${fromKey}`;
  const toPath = `submissions/${storeKey}/${type}/${toKey}`;

  const fromSnap = await get(ref(db, fromPath));
  const fromData = fromSnap.val() as Record<string, unknown> | null;
  if (!fromData) throw new Error('移動元のデータがありません');

  const toSnap = await get(ref(db, toPath));
  const toData = toSnap.val() as Record<string, unknown> | null;

  const fromPhotos = normalisePhotosObj(fromData.photos);
  const toPhotos = normalisePhotosObj(toData?.photos);
  const mergedPhotos: Record<string, string> = { ...fromPhotos, ...toPhotos };

  const fromMeta = (fromData.photoMeta || {}) as Record<string, { uploadedAt: string }>;
  const toMeta = (toData?.photoMeta || {}) as Record<string, { uploadedAt: string }>;
  const mergedMeta: Record<string, { uploadedAt: string }> = { ...fromMeta, ...toMeta };

  const viaLine = !!(fromData.viaLine || toData?.viaLine);
  const photoCount = Object.keys(mergedPhotos).length;
  const count = viaLine
    ? Math.max(photoCount, Number(fromData.count) || 0, Number(toData?.count) || 0)
    : photoCount;

  const submission: Record<string, unknown> = {
    count,
    submittedAt:
      (fromData.submittedAt as string) ||
      (toData?.submittedAt as string) ||
      new Date().toISOString(),
    photos: mergedPhotos,
    storeName: (toData?.storeName as string) || (fromData.storeName as string) || '',
  };
  if (viaLine) submission.viaLine = true;
  if (Object.keys(mergedMeta).length > 0) submission.photoMeta = mergedMeta;

  await withRetry(() => set(ref(db, toPath), submission));
  await withRetry(() => set(ref(db, fromPath), null));
};

export const deletePhoto = async (
  storeKey: StoreKey,
  type: ReportType,
  dateOrWeekKey: string,
  slotIndex: number,
): Promise<void> => {
  await ensureAuth();
  const path = `submissions/${storeKey}/${type}/${dateOrWeekKey}`;
  const snap = await get(ref(db, path));
  const existing = snap.val() as Record<string, unknown> | null;
  if (!existing) return;

  const photosObj = normalisePhotosObj(existing.photos);
  delete photosObj[String(slotIndex)];

  const meta = (existing.photoMeta || {}) as Record<string, { uploadedAt: string }>;
  const newMeta = { ...meta };
  delete newMeta[String(slotIndex)];

  const photoCount = Object.keys(photosObj).length;
  const viaLine = !!existing.viaLine;

  if (photoCount === 0 && !viaLine) {
    await withRetry(() => set(ref(db, path), null));
    return;
  }

  const submission: Record<string, unknown> = {
    count: viaLine ? Math.max(photoCount, Number(existing.count) || 0) : photoCount,
    submittedAt: (existing.submittedAt as string) || new Date().toISOString(),
    photos: photosObj,
    storeName: (existing.storeName as string) || '',
  };
  if (viaLine) submission.viaLine = true;
  if (Object.keys(newMeta).length > 0) submission.photoMeta = newMeta;

  await withRetry(() => set(ref(db, path), submission));
};