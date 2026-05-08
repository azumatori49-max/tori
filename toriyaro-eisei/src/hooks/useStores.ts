import { useCallback, useEffect, useState } from 'react';
import { onValue, ref, remove, set, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { hashPassword } from '../lib/crypto';
import { INITIAL_STORES } from '../data/stores';
import type { Store, StoreKey } from '../types';

const generateStoreKey = (): StoreKey => {
  const random = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  return `store_${random}`;
};

export const useStores = () => {
  const [stores, setStores] = useState<Record<StoreKey, Store>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storesRef = ref(db, 'stores');
    // Firebase RTDB がハングした場合に UI をロックさせないための保険。
    const timeout = window.setTimeout(() => {
      setLoading(false);
      setError('店舗データの取得に時間がかかっています。通信状況を確認してください。');
    }, 10_000);
    const unsub = onValue(
      storesRef,
      (snap) => {
        window.clearTimeout(timeout);
        const value = snap.val() as Record<StoreKey, Store> | null;
        setStores(value ?? {});
        setError(null);
        setLoading(false);
      },
      (err) => {
        window.clearTimeout(timeout);
        setError(err.message ?? '店舗データの取得に失敗しました。');
        setLoading(false);
      },
    );
    return () => {
      window.clearTimeout(timeout);
      unsub();
    };
  }, []);

  const seedInitialStores = useCallback(async () => {
    const entries = await Promise.all(
      Object.entries(INITIAL_STORES).map(async ([key, { name, password }]) => {
        const passwordHash = await hashPassword(password, key);
        return [key, { name, passwordHash }] as const;
      }),
    );
    const payload: Record<StoreKey, Store> = Object.fromEntries(entries);
    await set(ref(db, 'stores'), payload);
  }, []);

  const addStore = useCallback(async (name: string, password: string) => {
    const key = generateStoreKey();
    const passwordHash = await hashPassword(password, key);
    await update(ref(db, `stores/${key}`), { name, passwordHash });
    return key;
  }, []);

  const addStoresBulk = useCallback(
    async (rows: Array<{ name: string; password: string }>) => {
      const updates: Record<string, Store> = {};
      await Promise.all(
        rows.map(async (row) => {
          const key = generateStoreKey();
          const passwordHash = await hashPassword(row.password, key);
          updates[`stores/${key}`] = { name: row.name, passwordHash };
        }),
      );
      await update(ref(db), updates);
    },
    [],
  );

  const deleteStore = useCallback(async (key: StoreKey) => {
    await remove(ref(db, `stores/${key}`));
  }, []);

  return {
    stores,
    loading,
    error,
    seedInitialStores,
    addStore,
    addStoresBulk,
    deleteStore,
  };
};
