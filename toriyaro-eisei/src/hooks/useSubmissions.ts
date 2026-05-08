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
    if (!original) {
      throw new Error(`photo ${i + 1} is missing`);
    }
    const blob = await compressImage(original);
    const path = `photos/${storeKey}/${type}/${dateOrWeekKey}/${i}_${Date.now()}.jpg`;
    const ref0 = storageRef(storage, path);
    await uploadBytes(ref0, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(ref0);
    console.log(`[submitPhotos] uploaded ${i + 1}/${total}`, { url });
    if (typeof url !== 'string' || url.length === 0) {
      throw new Error(`download URL missing for photo ${i + 1}`);
    }
    urls.push(url);
    onProgress?.(i + 1, total);
  }

  // Re-build array from explicit indices to defeat any possibility of holes.
  const cleanPhotos: string[] = [];
  for (let i = 0; i < urls.length; i += 1) {
    const u = urls[i];
    if (typeof u !== 'string' || u.length === 0) {
      throw new Error(`photo URL invalid at index ${i}`);
    }
    cleanPhotos.push(u);
  }
  if (cleanPhotos.length !== files.length) {
    throw new Error(
      `photo upload incomplete: expected ${files.length}, got ${cleanPhotos.length}`,
    );
  }

  // RTDB serialises arrays as numeric-keyed objects; pre-build that shape so a
  // sparse JS array can never reach the SDK validator.
  const photosObj: Record<string, string> = {};
  cleanPhotos.forEach((u, i) => {
    photosObj[String(i)] = u;
  });

  const submission = {
    count: cleanPhotos.length,
    submittedAt: new Date().toISOString(),
    photos: photosObj,
    storeName,
  };

  console.log('[submitPhotos] writing submission', {
    path: `submissions/${storeKey}/${type}/${dateOrWeekKey}`,
    submission,
  });
  await set(ref(db, `submissions/${storeKey}/${type}/${dateOrWeekKey}`), submission);
  return cleanPhotos;
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
