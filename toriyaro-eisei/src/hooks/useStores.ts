import { onValue, ref, remove, set, update } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { INITIAL_STORES } from '../data/stores';
import type { Store, StoreKey } from '../types';

export type StoreMap = Record<StoreKey, Store>;

export const useStores = () => {
  const [stores, setStores] = useState<StoreMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = ref(db, 'stores');
    const unsub = onValue(r, (snap) => {
      const v = snap.val() as StoreMap | null;
      setStores(v ?? {});
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const seedInitialStores = useCallback(async () => {
    await set(ref(db, 'stores'), INITIAL_STORES);
  }, []);

  const addStore = useCallback(async (name: string, password: string) => {
    const key = `store_${Math.random().toString(16).slice(2, 10)}`;
    await set(ref(db, `stores/${key}`), { name, password });
    return key;
  }, []);

  const updateStore = useCallback(
    async (key: StoreKey, patch: Partial<Store>) => {
      await update(ref(db, `stores/${key}`), patch);
    },
    []
  );

  const deleteStore = useCallback(async (key: StoreKey) => {
    await remove(ref(db, `stores/${key}`));
  }, []);

  const bulkImport = useCallback(
    async (rows: Array<{ name: string; password: string }>) => {
      const updates: Record<string, Store> = {};
      for (const row of rows) {
        const key = `store_${Math.random().toString(16).slice(2, 10)}`;
        updates[key] = row;
      }
      const current = stores;
      await set(ref(db, 'stores'), { ...current, ...updates });
    },
    [stores]
  );

  return {
    stores,
    loading,
    seedInitialStores,
    addStore,
    updateStore,
    deleteStore,
    bulkImport,
  };
};
