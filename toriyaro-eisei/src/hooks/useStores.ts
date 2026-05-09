import { useEffect, useState } from "react";
import { onValue, ref, set, remove } from "firebase/database";
import { db } from "../lib/firebase";
import type { Store, StoreKey } from "../types";
import { INITIAL_STORES } from "../data/stores";

export const useStores = () => {
  const [stores, setStores] = useState<Record<StoreKey, Store>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = ref(db, "stores");
    const unsub = onValue(
      r,
      (snap) => {
        const v = snap.val() as Record<StoreKey, Store> | null;
        setStores(v ?? {});
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  const seedAll = async () => {
    await set(ref(db, "stores"), INITIAL_STORES);
  };

  const addStore = async (key: StoreKey, store: Store) => {
    await set(ref(db, `stores/${key}`), store);
  };

  const deleteStore = async (key: StoreKey) => {
    await remove(ref(db, `stores/${key}`));
  };

  return { stores, loading, seedAll, addStore, deleteStore };
};

export const generateStoreKey = (): StoreKey => {
  const hex = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
  return `store_${hex}`;
};
