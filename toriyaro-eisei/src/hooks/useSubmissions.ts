import { get, onValue, ref, set } from 'firebase/database';
import { getDownloadURL, ref as sRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { db, storage } from '../lib/firebase';
import type { ReportType, StoreKey, Submission } from '../types';

const compressImage = (file: File, maxWidth = 1200): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error('compression failed'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image load failed'));
    };
    img.src = url;
  });

export const useSubmission = (
  storeKey: StoreKey | null,
  type: ReportType,
  key: string
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
    const r = ref(db, `submissions/${storeKey}/${type}/${key}`);
    const unsub = onValue(r, (snap) => {
      const v = snap.val() as Submission | null;
      setSubmission(v);
      setLoading(false);
    });
    return () => unsub();
  }, [storeKey, type, key]);

  return { submission, loading };
};

export interface AllSubmissionsResult {
  submissions: Record<StoreKey, Submission | null>;
  loading: boolean;
  reload: () => Promise<void>;
}

export const useAllSubmissions = (
  storeKeys: StoreKey[],
  type: ReportType,
  key: string
): AllSubmissionsResult => {
  const [submissions, setSubmissions] = useState<Record<StoreKey, Submission | null>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (storeKeys.length === 0) {
      setSubmissions({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const results = await Promise.all(
      storeKeys.map((k) =>
        get(ref(db, `submissions/${k}/${type}/${key}`)).then((s) => [k, s.val() as Submission | null] as const)
      )
    );
    const map: Record<StoreKey, Submission | null> = {};
    for (const [k, v] of results) map[k] = v;
    setSubmissions(map);
    setLoading(false);
  }, [storeKeys.join('|'), type, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  return { submissions, loading, reload: load };
};

export const submitReport = async (
  storeKey: StoreKey,
  storeName: string,
  type: ReportType,
  key: string,
  files: File[]
): Promise<void> => {
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const blob = await compressImage(files[i]);
    const path = `photos/${storeKey}/${type}/${key}/${i}_${Date.now()}.jpg`;
    const sref = sRef(storage, path);
    await uploadBytes(sref, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(sref);
    urls.push(url);
  }
  const payload: Submission = {
    count: urls.length,
    submittedAt: new Date().toISOString(),
    photos: urls,
    storeName,
  };
  await set(ref(db, `submissions/${storeKey}/${type}/${key}`), payload);
};
