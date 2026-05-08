import { useCallback, useEffect, useState } from 'react';
import { onValue, ref, remove, set, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { INITIAL_STORES } from '../data/stores';
import type { Store, StoreKey } from '../types';

const generateStoreKey = (): StoreKey => {
  const random = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  return `store_${random}`;
};

export const useStores = () => {
  const [stores, setStores] = useState<Record<StoreKey, Store>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storesRef = ref(db, 'stores');
    const unsub = onValue(
      storesRef,
      (snap) => {
        const value = snap.val() as Record<StoreKey, Store> | null;
        setStores(value ?? {});
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  const seedInitialStores = useCallback(async () => {
    await set(ref(db, 'stores'), INITIAL_STORES);
  }, []);

  const addStore = useCallback(async (name: string, password: string) => {
    const key = generateStoreKey();
    await update(ref(db, `stores/${key}`), { name, password });
    return key;
  }, []);

  const addStoresBulk = useCallback(async (rows: Array<{ name: string; password: string }>) => {
    const updates: Record<string, Store> = {};
    for (const row of rows) {
      const key = generateStoreKey();
      updates[`stores/${key}`] = { name: row.name, password: row.password };
    }
    await update(ref(db), updates);
  }, []);

  const deleteStore = useCallback(async (key: StoreKey) => {
    await remove(ref(db, `stores/${key}`));
  }, []);

  return { stores, loading, seedInitialStores, addStore, addStoresBulk, deleteStore };
};
