import { useCallback, useEffect, useRef, useState } from "react";
import { get, onValue, ref, set } from "firebase/database";
import { getDownloadURL, ref as sref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import type { ReportType, StoreKey, Submission } from "../types";
import { compressImage } from "../lib/imageCompress";

export const useStoreSubmission = (
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
    const r = ref(db, `submissions/${storeKey}/${type}/${key}`);
    const unsub = onValue(
      r,
      (snap) => {
        setSubmission((snap.val() as Submission | null) ?? null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [storeKey, type, key]);

  return { submission, loading };
};

export const useAllSubmissions = (
  storeKeys: StoreKey[],
  type: ReportType,
  key: string,
) => {
  const [data, setData] = useState<Record<StoreKey, Submission | null>>({});
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);

  useEffect(() => {
    if (storeKeys.length === 0) {
      setData({});
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    Promise.all(
      storeKeys.map((sk) =>
        get(ref(db, `submissions/${sk}/${type}/${key}`))
          .then((snap) => [sk, (snap.val() as Submission | null) ?? null] as const)
          .catch(() => [sk, null] as const),
      ),
    ).then((entries) => {
      if (id !== reqId.current) return;
      setData(Object.fromEntries(entries));
      setLoading(false);
    });
  }, [storeKeys.join("|"), type, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading };
};

export const useSubmit = () => {
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (
      storeKey: StoreKey,
      storeName: string,
      type: ReportType,
      key: string,
      files: File[],
    ) => {
      setSubmitting(true);
      setProgress(0);
      try {
        const urls: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const blob = await compressImage(files[i]);
          const path = `photos/${storeKey}/${type}/${key}/${i}_${Date.now()}.jpg`;
          const ref_ = sref(storage, path);
          await uploadBytes(ref_, blob, { contentType: "image/jpeg" });
          const url = await getDownloadURL(ref_);
          urls.push(url);
          setProgress(((i + 1) / files.length) * 100);
        }
        await set(ref(db, `submissions/${storeKey}/${type}/${key}`), {
          count: urls.length,
          submittedAt: new Date().toISOString(),
          photos: urls,
          storeName,
        } satisfies Submission);
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  return { submit, submitting, progress };
};
