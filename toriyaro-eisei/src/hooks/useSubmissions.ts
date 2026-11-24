import { useCallback, useEffect, useState } from 'react';
import { get, onValue, push, ref, set, update } from 'firebase/database';
import {
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
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

export type SubmitSlot =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File }
  | { kind: 'empty' };

/** 動画1本の上限（storage.rules の videos/ と合わせる） */
export const VIDEO_MAX_BYTES = 500 * 1024 * 1024;
export const VIDEO_MAX_LABEL = '500MB';

const isVideoFile = (file: File): boolean => file.type.startsWith('video/');

/**
 * 動画は大きいので、途中で切れても続きから送れる再開可能アップロードを使う。
 * onBytes で送信済みバイト数を通知する（進み具合の表示用）。
 */
const uploadVideoResumable = (
  path: string,
  file: File,
  onBytes?: (loaded: number, total: number) => void,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = storageRef(storage, path);
    const task = uploadBytesResumable(r, file, { contentType: file.type });
    task.on(
      'state_changed',
      (snap) => onBytes?.(snap.bytesTransferred, snap.totalBytes),
      (err) => reject(err),
      () => {
        getDownloadURL(task.snapshot.ref).then(resolve, reject);
      },
    );
  });

export interface SubmitSlotsArgs {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  dateOrWeekKey: string;
  slots: SubmitSlot[];
  onProgress?: (uploaded: number, totalNew: number) => void;
  /** 動画など大きいファイルの送信中に、そのファイルの送信済みバイト数を通知する */
  onBytes?: (loaded: number, total: number) => void;
}

export const submitSlots = async ({
  storeKey,
  storeName,
  type,
  dateOrWeekKey,
  slots,
  onProgress,
  onBytes,
}: SubmitSlotsArgs): Promise<Record<string, string>> => {
  await ensureAuth();

  const path = `submissions/${storeKey}/${type}/${dateOrWeekKey}`;

  const existingSnap = await withRetry(() => get(ref(db, path)));
  const existing = existingSnap.val() as
    | {
        photoMeta?: Record<string, { uploadedAt: string }>;
        viaLine?: boolean;
        count?: number;
      }
    | null;
  const existingMeta = existing?.photoMeta || {};

  // 管理者が「LINE報告」にした日は viaLine と count（規定枚数）が入っている。
  // 店舗側の再提出で count を下げない（moveSubmission の viaLine 保持と同じ考え方）。
  const viaLine = !!existing?.viaLine;
  const baseCount = Number(existing?.count) || 0;
  const countFor = (n: number): number => (viaLine ? Math.max(baseCount, n) : n);

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
        if (isVideoFile(slot.file)) {
          // 動画は圧縮せずそのまま videos/ に送る（年間スケジュールの動画項目だけが使う）
          if (slot.file.size >= VIDEO_MAX_BYTES) {
            throw new Error(`動画が大きすぎます（${VIDEO_MAX_LABEL}まで）。短く撮り直してください`);
          }
          const ext = slot.file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
          const objectPath = `videos/${storeKey}/${type}/${dateOrWeekKey}/${i}_${Date.now()}.${ext}`;
          const file = slot.file;
          url = await withRetry(() => uploadVideoResumable(objectPath, file, onBytes), 2);
        } else {
          const { blob, type: contentType } = await prepareBlob(slot.file);
          const objectPath = `photos/${storeKey}/${type}/${dateOrWeekKey}/${i}_${Date.now()}.jpg`;
          const ref0 = storageRef(storage, objectPath);
          await withRetry(() => uploadBytes(ref0, blob, { contentType }));
          url = await withRetry(() => getDownloadURL(ref0));
        }
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
          count: countFor(savedCount),
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

  // set ではなく update にして、viaLine など他のキーを消さない。
  // photos / photoMeta はキー単位ではなくオブジェクトごと置き換える（外したスロットは消える）。
  // 値に undefined を入れると SDK がエラーになるので入れない。
  const submission = {
    count: countFor(savedCount),
    submittedAt: new Date().toISOString(),
    photos: photosObj,
    storeName,
    photoMeta,
  };

  await withRetry(() => update(ref(db, path), submission));
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