import { useCallback, useEffect, useState } from 'react';
import { get, onValue, ref, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
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

export interface SubmitArgs {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  dateOrWeekKey: string;
  files: File[];
  onProgress?: (uploaded: number, total: number) => void;
}

export const submitPhotos = async ({
  storeKey,
  storeName,
  type,
  dateOrWeekKey,
  files,
  onProgress,
}: SubmitArgs): Promise<string[]> => {
  const total = files.length;
  const urls: string[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const original = files[i];
    const blob = await compressImage(original);
    const path = `photos/${storeKey}/${type}/${dateOrWeekKey}/${i}_${Date.now()}.jpg`;
    const ref0 = storageRef(storage, path);
    await uploadBytes(ref0, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(ref0);
    urls.push(url);
    onProgress?.(i + 1, total);
  }

  const submission: Submission = {
    count: urls.length,
    submittedAt: new Date().toISOString(),
    photos: urls,
    storeName,
  };

  await set(ref(db, `submissions/${storeKey}/${type}/${dateOrWeekKey}`), submission);
  return urls;
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
