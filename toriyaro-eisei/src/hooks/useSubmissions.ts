import { useCallback, useEffect, useState } from 'react';
import {
  endAt,
  get,
  onValue,
  orderByKey,
  push,
  query,
  ref,
  runTransaction,
  set,
  startAt,
} from 'firebase/database';
import {
  ref as storageRef,
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
        // 長辺が maxWidth に収まるように縮小する（縦長の写真も同じ基準）
        const ratio = Math.min(maxWidth / Math.max(img.width, img.height), 1);
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

/**
 * 送る画像を用意する。
 * - 縮小しても元より小さくならない JPEG/PNG/WebP は、元のファイルをそのまま送る
 * - 圧縮に失敗しても、元画像が4.5MB以下ならそのまま送る
 */
export const prepareBlob = async (file: File): Promise<{ blob: Blob; type: string }> => {
  try {
    const blob = await compressImage(file);
    return file.size <= blob.size && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      ? { blob: file, type: file.type }
      : { blob, type: 'image/jpeg' };
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
 * 写真・動画とも、途中で切れても続きから送れる再開可能アップロードを使う。
 * onBytes で送信済みバイト数を通知する（進み具合の表示用）。
 */
const uploadResumable = (
  path: string,
  blob: Blob,
  onBytes?: (loaded: number, total: number) => void,
  contentType: string = blob.type,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = storageRef(storage, path);
    const task = uploadBytesResumable(r, blob, { contentType });
    task.on(
      'state_changed',
      (snap) => onBytes?.(snap.bytesTransferred, snap.totalBytes),
      (err) => reject(err),
      () => {
        getDownloadURL(task.snapshot.ref).then(resolve, reject);
      },
    );
  });

type PhotoMeta = Record<string, { uploadedAt: string }>;
type StoredSubmission = {
  photos?: Record<string, unknown> | unknown[];
  photoMeta?: PhotoMeta;
  viaLine?: boolean;
  count?: number;
  [key: string]: unknown;
};

/**
 * 保存済みの提出に、今回の写真を重ねた新しい内容を作る（トランザクションの中で使う）。
 * - 保存済みの写真はそのまま残し、同じ番号だけ今回の写真で置き換える
 * - removedUrls に入っているURLの写真は外す（複数枚OKの項目で「×」で外した分）
 * - LINE報告済み（viaLine）の日は count を下げない
 */
const mergeSubmission = (
  current: StoredSubmission | null,
  photos: Record<string, string>,
  photoMeta: PhotoMeta,
  storeName: string,
  submittedAt: string,
  removedUrls: string[] = [],
) => {
  const nextPhotos: Record<string, string> = {};
  const nextMeta: PhotoMeta = { ...current?.photoMeta };
  for (const [key, url] of Object.entries(current?.photos ?? {})) {
    if (typeof url !== 'string' || !url) continue;
    if (removedUrls.includes(url)) delete nextMeta[key];
    else nextPhotos[key] = url;
  }
  Object.assign(nextPhotos, photos);
  Object.assign(nextMeta, photoMeta);
  const n = Object.keys(nextPhotos).length;
  return {
    ...current,
    photos: nextPhotos,
    photoMeta: nextMeta,
    count: current?.viaLine ? Math.max(current.count ?? 0, n) : n,
    storeName,
    submittedAt,
  };
};

export interface SubmitSlotsArgs {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  dateOrWeekKey: string;
  slots: SubmitSlot[];
  onProgress?: (uploaded: number, totalNew: number) => void;
  /** 送信中のファイルの送信済みバイト数を通知する */
  onBytes?: (loaded: number, total: number) => void;
  /** 今回の提出で外す保存済み写真のURL（複数枚OKの項目で「×」で外した分） */
  removedPhotoUrls?: string[];
}

/**
 * 新しく選んだ写真（kind: 'new'）だけを送り、1枚送るごとにトランザクションで保存済みの内容に重ねる。
 * 画面を開いたあとに別の端末が保存した写真や、本部のLINE報告を消さないため、
 * 保存は「読んでから上書き」ではなくトランザクションで行う。
 */
export const submitSlots = async ({
  storeKey,
  storeName,
  type,
  dateOrWeekKey,
  slots,
  onProgress,
  onBytes,
  removedPhotoUrls = [],
}: SubmitSlotsArgs): Promise<Record<string, string>> => {
  await ensureAuth();

  const path = `submissions/${storeKey}/${type}/${dateOrWeekKey}`;
  const totalNew = slots.filter((s) => s.kind === 'new').length;
  let uploadedCount = 0;

  for (let i = 0; i < slots.length; i += 1) {
    if (i >= 20) break;
    const slot = slots[i];
    const key = String(i);
    if (slot.kind !== 'new') continue;

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
        url = await withRetry(() => uploadResumable(objectPath, file, onBytes), 2);
      } else {
        const { blob, type: contentType } = await prepareBlob(slot.file);
        const objectPath = `photos/${storeKey}/${type}/${dateOrWeekKey}/${i}_${Date.now()}.jpg`;
        url = await withRetry(() => uploadResumable(objectPath, blob, onBytes, contentType));
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

    // 1枚成功するごとに保存する（途中で失敗しても、ここまでの分は残る）
    await withRetry(() =>
      runTransaction(
        ref(db, path),
        (current: StoredSubmission | null) =>
          mergeSubmission(current, { [key]: url }, { [key]: meta }, storeName, meta.uploadedAt),
        { applyLocally: false },
      ),
    );
    uploadedCount += 1;
    onProgress?.(uploadedCount, totalNew);
  }

  // 最後に、外した写真を反映して提出日時を更新し、サーバーに保存された内容を確認する
  const submittedAt = new Date().toISOString();
  const result = await withRetry(() =>
    runTransaction(
      ref(db, path),
      (current: StoredSubmission | null) =>
        mergeSubmission(current, {}, {}, storeName, submittedAt, removedPhotoUrls),
      { applyLocally: false },
    ),
  );
  return normalisePhotosObj((result.snapshot.val() as StoredSubmission | null)?.photos);
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

/**
 * 1店舗ぶんの提出データを、キーの範囲（fromKey〜toKey・両端含む）でまとめて1回で読む。
 * 日ごとに1件ずつ読むより通信回数が大幅に少ない（未提出回数の集計用）。
 * 失敗したときは例外を投げる（「読めなかった」を「未提出」と取り違えないため）。
 */
export const fetchSubmissionRange = async (
  storeKey: StoreKey,
  type: ReportType,
  fromKey: string,
  toKey: string,
): Promise<Record<string, Submission>> => {
  const snap = await get(
    query(ref(db, `submissions/${storeKey}/${type}`), orderByKey(), startAt(fromKey), endAt(toKey)),
  );
  return (snap.val() as Record<string, Submission> | null) ?? {};
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