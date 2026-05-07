import { get, ref, set as dbSet } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { authReady, db, storage } from '../lib/firebase';
import { compressImage } from '../lib/imageUtils';
import type { ReportType, StoreKey, Submission } from '../types';

export type SubmissionMap = Record<StoreKey, Submission | null>;

export const useSubmissionFor = (
  storeKey: StoreKey | null,
  type: ReportType,
  periodKey: string,
) => {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    if (!storeKey) {
      setSubmission(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    authReady
      .then(() => get(ref(db, `submissions/${storeKey}/${type}/${periodKey}`)))
      .then((snap) => {
        if (cancelled) return;
        setSubmission((snap.val() as Submission | null) ?? null);
      })
      .catch((err) => {
        if (!cancelled) console.error('submission fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeKey, type, periodKey, reloadIndex]);

  const reload = useCallback(() => setReloadIndex((i) => i + 1), []);

  return { submission, loading, reload };
};

export const fetchSubmissionsBulk = async (
  storeKeys: StoreKey[],
  type: ReportType,
  periodKey: string,
): Promise<SubmissionMap> => {
  await authReady;
  const results = await Promise.all(
    storeKeys.map((key) =>
      get(ref(db, `submissions/${key}/${type}/${periodKey}`))
        .then((snap) => [key, (snap.val() as Submission | null) ?? null] as const)
        .catch(() => [key, null] as const),
    ),
  );
  return Object.fromEntries(results);
};

const PARALLELISM = 3;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const uploadOne = async (
  storeKey: StoreKey,
  type: ReportType,
  periodKey: string,
  idx: number,
  file: File,
): Promise<string> => {
  const blob = await compressImage(file).catch(() => file);
  const path = `photos/${storeKey}/${type}/${periodKey}/${idx}_${Date.now()}.jpg`;
  const sref = storageRef(storage, path);
  await uploadBytes(sref, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(sref);
};

const uploadOneWithRetry = async (
  storeKey: StoreKey,
  type: ReportType,
  periodKey: string,
  idx: number,
  file: File,
  onAttempt?: (attempt: number) => void,
): Promise<string> => {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    onAttempt?.(attempt);
    try {
      return await uploadOne(storeKey, type, periodKey, idx, file);
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_RETRIES) {
        await sleep(500 * 2 ** (attempt - 1));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('upload failed');
};

export interface UploadProgress {
  uploaded: number;
  total: number;
  retrying: number;
}

export const uploadSinglePhoto = async (params: {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  periodKey: string;
  idx: number;
  file: File;
}): Promise<{ url: string; count: number }> => {
  const { storeKey, storeName, type, periodKey, idx, file } = params;
  await authReady;

  const url = await uploadOneWithRetry(storeKey, type, periodKey, idx, file);

  const path = `submissions/${storeKey}/${type}/${periodKey}`;
  const snap = await get(ref(db, path));
  const existing = (snap.val() as Submission | null) ?? null;
  const photos = [...(existing?.photos ?? [])];
  photos[idx] = url;
  const count = photos.filter(Boolean).length;

  const next: Submission = {
    count,
    photos,
    submittedAt: new Date().toISOString(),
    storeName,
  };
  await dbSet(ref(db, path), next);
  return { url, count };
};

export const submitReport = async (params: {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  periodKey: string;
  files: File[];
  onProgress?: (progress: UploadProgress) => void;
}): Promise<Submission> => {
  const { storeKey, storeName, type, periodKey, files, onProgress } = params;
  await authReady;
  const total = files.length;
  const urls: string[] = new Array(total);
  let completed = 0;
  let retrying = 0;

  const queue = files.map((file, idx) => ({ file, idx }));
  const emit = () => onProgress?.({ uploaded: completed, total, retrying });

  const worker = async () => {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      const url = await uploadOneWithRetry(
        storeKey,
        type,
        periodKey,
        job.idx,
        job.file,
        (attempt) => {
          if (attempt > 1) {
            retrying += 1;
            emit();
          }
        },
      );
      urls[job.idx] = url;
      completed += 1;
      emit();
    }
  };

  emit();
  await Promise.all(Array.from({ length: Math.min(PARALLELISM, total) }, worker));

  const submission: Submission = {
    count: urls.length,
    submittedAt: new Date().toISOString(),
    photos: urls,
    storeName,
  };
  await dbSet(ref(db, `submissions/${storeKey}/${type}/${periodKey}`), submission);
  return submission;
};
