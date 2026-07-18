import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { withRetry } from '../lib/retry';
import type { Store, StoreKey } from '../types';

export type StoreMap = Record<StoreKey, Store>;

const randomKey = (): string => {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return `store_${Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * 店舗マスタ。
 * 読み取りは全員可（ログイン画面の店舗一覧に使うため。名前しか入っていない）。
 * 追加・削除・パスワード設定はセキュリティルールにより管理者のみ。
 * パスワードは stores ではなく storePasswords コレクションに分離して保存し、
 * 店舗スタッフや第三者からは一切読めない。
 */
export const useStores = () => {
  const [stores, setStores] = useState<StoreMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'stores'),
      (snap) => {
        const map: StoreMap = {};
        snap.forEach((d) => {
          const data = d.data() as { name?: string };
          if (data.name) map[d.id] = { name: data.name };
        });
        setStores(map);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const addStore = useCallback(async (name: string, password: string) => {
    const key = randomKey();
    await withRetry(() => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'stores', key), { name, createdAt: serverTimestamp() });
      batch.set(doc(db, 'storePasswords', key), { password });
      return batch.commit();
    });
    return key;
  }, []);

  const updateStore = useCallback(async (key: StoreKey, patch: Partial<Store>) => {
    await withRetry(() => {
      const batch = writeBatch(db);
      batch.update(doc(db, 'stores', key), { ...patch });
      return batch.commit();
    });
  }, []);

  const setStorePassword = useCallback(async (key: StoreKey, password: string) => {
    await withRetry(() => {
      const batch = writeBatch(db);
      batch.set(doc(db, 'storePasswords', key), { password });
      return batch.commit();
    });
  }, []);

  const deleteStore = useCallback(async (key: StoreKey) => {
    // 過去の提出データ・写真は監査のため残す（消したい場合は Firebase コンソールから）
    await withRetry(async () => {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'stores', key));
      batch.delete(doc(db, 'storePasswords', key));
      await batch.commit();
    });
  }, []);

  const bulkImport = useCallback(
    async (rows: Array<{ name: string; password: string }>) => {
      // Firestore のバッチ上限（500件）に収まるよう分割してコミット
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        await withRetry(() => {
          const batch = writeBatch(db);
          for (const row of chunk) {
            const key = randomKey();
            batch.set(doc(db, 'stores', key), {
              name: row.name,
              createdAt: serverTimestamp(),
            });
            batch.set(doc(db, 'storePasswords', key), { password: row.password });
          }
          return batch.commit();
        });
      }
    },
    []
  );

  return {
    stores,
    loading,
    addStore,
    updateStore,
    setStorePassword,
    deleteStore,
    bulkImport,
  };
};
