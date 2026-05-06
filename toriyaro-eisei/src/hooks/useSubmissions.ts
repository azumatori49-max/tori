import { get, ref, set as dbSet } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { db, storage } from '../lib/firebase';
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
    get(ref(db, `submissions/${storeKey}/${type}/${periodKey}`))
      .then((snap) => {
        if (cancelled) return;
        setSubmission((snap.val() as Submission | null) ?? null);
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
  const results = await Promise.all(
    storeKeys.map((key) =>
      get(ref(db, `submissions/${key}/${type}/${periodKey}`))
        .then((snap) => [key, (snap.val() as Submission | null) ?? null] as const)
        .catch(() => [key, null] as const),
    ),
  );
  return Object.fromEntries(results);
};

export const submitReport = async (params: {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  periodKey: string;
  files: File[];
  onProgress?: (uploaded: number, total: number) => void;
}): Promise<Submission> => {
  const { storeKey, storeName, type, periodKey, files, onProgress } = params;
  const urls: string[] = [];
  const total = files.length;
  for (let i = 0; i < total; i += 1) {
    const file = files[i];
    const blob = await compressImage(file).catch(() => file);
    const path = `photos/${storeKey}/${type}/${periodKey}/${i}_${Date.now()}.jpg`;
    const sref = storageRef(storage, path);
    await uploadBytes(sref, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(sref);
    urls.push(url);
    onProgress?.(i + 1, total);
  }
  const submission: Submission = {
    count: urls.length,
    submittedAt: new Date().toISOString(),
    photos: urls,
    storeName,
  };
  await dbSet(ref(db, `submissions/${storeKey}/${type}/${periodKey}`), submission);
  return submission;
};
