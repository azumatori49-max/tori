import { onValue, ref, remove, set, update } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { Store, StoreKey } from '../types';
import { INITIAL_STORES } from '../data/stores';
import { invalidateStoresCache } from './useStoresOnce';

type StoresMap = Record<StoreKey, Store>;

const STORES_PATH = 'stores';

const generateStoreKey = (): StoreKey => {
  const rand = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  return `store_${rand}`;
};

export const useStores = () => {
  const [stores, setStores] = useState<StoresMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, STORES_PATH), (snapshot) => {
      const value = (snapshot.val() as StoresMap | null) ?? {};
      setStores(value);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const seedInitialStores = useCallback(async () => {
    await set(ref(db, STORES_PATH), INITIAL_STORES);
    invalidateStoresCache();
  }, []);

  const addStore = useCallback(async (name: string, password: string) => {
    const key = generateStoreKey();
    await update(ref(db), {
      [`${STORES_PATH}/${key}`]: { name, password },
    });
    invalidateStoresCache();
    return key;
  }, []);

  const addStoresBulk = useCallback(async (entries: Array<{ name: string; password: string }>) => {
    const updates: Record<string, Store> = {};
    for (const entry of entries) {
      const key = generateStoreKey();
      updates[`${STORES_PATH}/${key}`] = { name: entry.name, password: entry.password };
    }
    await update(ref(db), updates);
    invalidateStoresCache();
    return Object.keys(updates).length;
  }, []);

  const deleteStore = useCallback(async (key: StoreKey) => {
    await remove(ref(db, `${STORES_PATH}/${key}`));
    invalidateStoresCache();
  }, []);

  return {
    stores,
    loading,
    seedInitialStores,
    addStore,
    addStoresBulk,
    deleteStore,
  };
};

export const sortedStoreEntries = (stores: StoresMap): Array<[StoreKey, Store]> =>
  Object.entries(stores).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'ja'));
