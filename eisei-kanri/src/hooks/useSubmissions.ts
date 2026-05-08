import { get, ref, set } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { db, storage } from '../lib/firebase';
import { compressImage } from '../lib/imageUtils';
import type { ReportType, StoreKey, Submission } from '../types';

export type SubmissionMap = Record<StoreKey, Submission | null>;

export const normalizePhotos = (
  raw: Submission['photos'] | undefined,
  total: number,
): string[] => {
  const result = Array.from({ length: total }, () => '');
  if (!raw) return result;
  if (Array.isArray(raw)) {
    for (let i = 0; i < total; i++) result[i] = raw[i] ?? '';
  } else if (typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, string>)) {
      const idx = Number(k);
      if (!Number.isNaN(idx) && idx >= 0 && idx < total && typeof v === 'string') {
        result[idx] = v;
      }
    }
  }
  return result;
};

export const countPhotos = (photos: string[]): number =>
  photos.filter((p) => p && p.length > 0).length;

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
  total: number;
  files: (File | null)[];
  existingPhotos?: string[];
  onProgress?: (done: number, totalToUpload: number) => void;
}

export const submitReport = async ({
  storeKey,
  storeName,
  reportType,
  periodKey,
  total,
  files,
  existingPhotos = [],
  onProgress,
}: SubmitArgs): Promise<Submission> => {
  const photos = Array.from({ length: total }, (_, i) => existingPhotos[i] ?? '');
  const toUpload = files
    .map((file, idx) => (file ? { file, idx } : null))
    .filter((x): x is { file: File; idx: number } => x != null);
  const totalUpload = toUpload.length;

  for (let i = 0; i < toUpload.length; i++) {
    const { file, idx } = toUpload[i];
    const blob = await compressImage(file);
    const path = `photos/${storeKey}/${reportType}/${periodKey}/${idx}_${Date.now()}.jpg`;
    const sref = storageRef(storage, path);
    await uploadBytes(sref, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(sref);
    photos[idx] = url;
    onProgress?.(i + 1, totalUpload);
  }

  const submission: Submission = {
    count: countPhotos(photos),
    total,
    submittedAt: new Date().toISOString(),
    photos,
    storeName,
  };

  await set(ref(db, `submissions/${storeKey}/${reportType}/${periodKey}`), submission);
  return submission;
};
