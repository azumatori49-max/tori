import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as sRef, uploadBytes } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { db, storage } from '../lib/firebase';
import { withRetry, withTimeout } from '../lib/retry';
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

const submissionDoc = (storeKey: StoreKey, type: ReportType, key: string) =>
  doc(db, 'submissions', storeKey, type, key);

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
    const unsub = onSnapshot(
      submissionDoc(storeKey, type, key),
      (snap) => {
        setSubmission(snap.exists() ? (snap.data() as Submission) : null);
        setLoading(false);
      },
      () => {
        setSubmission(null);
        setLoading(false);
      }
    );
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
    try {
      const results = await Promise.all(
        storeKeys.map((k) =>
          withRetry(() => getDoc(submissionDoc(k, type, key)))
            .then((s) => [k, s.exists() ? (s.data() as Submission) : null] as const)
            .catch(() => [k, null] as const)
        )
      );
      const map: Record<StoreKey, Submission | null> = {};
      for (const [k, v] of results) map[k] = v;
      setSubmissions(map);
    } finally {
      setLoading(false);
    }
  }, [storeKeys.join('|'), type, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  return { submissions, loading, reload: load };
};

export type SubmitSlot =
  | { kind: 'new'; file: File }
  | { kind: 'existing'; url: string };

/**
 * レポート提出。写真1枚ごとに「圧縮 → タイムアウト付きアップロード →
 * 失敗時は指数バックオフで最大3回リトライ」してから、最後にまとめて
 * Firestore に保存する（こちらもリトライ付き）。
 */
export const submitReport = async (
  storeKey: StoreKey,
  storeName: string,
  type: ReportType,
  key: string,
  slots: SubmitSlot[]
): Promise<void> => {
  const urls: string[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.kind === 'existing') {
      urls.push(slot.url);
      continue;
    }
    const blob = await compressImage(slot.file);
    const path = `photos/${storeKey}/${type}/${key}/${i}_${Date.now()}.jpg`;
    try {
      const url = await withRetry(async () => {
        const sref = sRef(storage, path);
        await withTimeout(
          uploadBytes(sref, blob, { contentType: 'image/jpeg' }),
          60_000,
          `写真${i + 1}枚目のアップロード`
        );
        return getDownloadURL(sref);
      });
      urls.push(url);
    } catch (e) {
      throw new Error(
        `写真${i + 1}枚目の送信に失敗しました（${urls.length}枚は送信済み）。電波の良い場所でもう一度「提出する」を押してください。`
      );
    }
  }
  const payload: Submission = {
    count: urls.length,
    submittedAt: new Date().toISOString(),
    photos: urls,
    storeName,
  };
  await withRetry(() => setDoc(submissionDoc(storeKey, type, key), payload));
};
