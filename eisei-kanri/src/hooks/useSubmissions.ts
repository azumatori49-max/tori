import { get, ref, set } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { db, storage } from '../lib/firebase';
import { compressImage } from '../lib/imageUtils';
import type { ReportType, StoreKey, Submission } from '../types';

export type SubmissionMap = Record<StoreKey, Submission | null>;

export const useStoreSubmission = (
  storeKey: StoreKey | null,
  reportType: ReportType,
  periodKey: string,
) => {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!storeKey) return;
    setLoading(true);
    const snap = await get(ref(db, `submissions/${storeKey}/${reportType}/${periodKey}`));
    setSubmission((snap.val() as Submission | null) ?? null);
    setLoading(false);
  }, [storeKey, reportType, periodKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { submission, loading, reload };
};

export const useAdminSubmissions = (
  storeKeys: StoreKey[],
  reportType: ReportType,
  periodKey: string,
) => {
  const [submissions, setSubmissions] = useState<SubmissionMap>({});
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (storeKeys.length === 0) {
      setSubmissions({});
      return;
    }
    setLoading(true);
    const results = await Promise.all(
      storeKeys.map(async (key) => {
        const snap = await get(ref(db, `submissions/${key}/${reportType}/${periodKey}`));
        return [key, (snap.val() as Submission | null) ?? null] as const;
      }),
    );
    const next: SubmissionMap = {};
    for (const [key, val] of results) next[key] = val;
    setSubmissions(next);
    setLoading(false);
  }, [storeKeys.join('|'), reportType, periodKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reload();
  }, [reload]);

  return { submissions, loading, reload };
};

interface SubmitArgs {
  storeKey: StoreKey;
  storeName: string;
  reportType: ReportType;
  periodKey: string;
  files: File[];
  onProgress?: (done: number, total: number) => void;
}

export const submitReport = async ({
  storeKey,
  storeName,
  reportType,
  periodKey,
  files,
  onProgress,
}: SubmitArgs): Promise<Submission> => {
  const urls: string[] = [];
  const total = files.length;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const blob = await compressImage(file);
    const path = `photos/${storeKey}/${reportType}/${periodKey}/${i}_${Date.now()}.jpg`;
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

  await set(ref(db, `submissions/${storeKey}/${reportType}/${periodKey}`), submission);
  return submission;
};
