import { onValue, ref, remove, set, update } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { INITIAL_STORES } from '../data/stores';
import type { Store, StoreKey } from '../types';

export type StoreMap = Record<StoreKey, Store>;

export const useStores = () => {
  const [stores, setStores] = useState<StoreMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storesRef = ref(db, 'stores');
    const unsub = onValue(
      storesRef,
      (snap) => {
        const val = (snap.val() as StoreMap | null) ?? {};
        setStores(val);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const seedAllStores = useCallback(async () => {
    await set(ref(db, 'stores'), INITIAL_STORES);
  }, []);

  const addStore = useCallback(async (storeKey: StoreKey, store: Store) => {
    await set(ref(db, `stores/${storeKey}`), store);
  }, []);

  const updateStore = useCallback(async (storeKey: StoreKey, patch: Partial<Store>) => {
    await update(ref(db, `stores/${storeKey}`), patch);
  }, []);

  const deleteStore = useCallback(async (storeKey: StoreKey) => {
    await remove(ref(db, `stores/${storeKey}`));
  }, []);

  const generateStoreKey = useCallback(() => {
    const random = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
    return `store_${random}`;
  }, []);

  return {
    stores,
    loading,
    error,
    seedAllStores,
    addStore,
    updateStore,
    deleteStore,
    generateStoreKey,
  };
};
