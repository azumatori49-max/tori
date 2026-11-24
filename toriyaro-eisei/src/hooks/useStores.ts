import { useCallback, useEffect, useState } from 'react';
import { onValue, ref, remove, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { hashPassword } from '../lib/crypto';
import { getDateKey } from '../lib/dateUtils';
import { openingDateToIso } from '../lib/storeOpening';
import type { Store, StoreKey } from '../types';

const generateStoreKey = (): StoreKey => {
  const random = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  return `store_${random}`;
};

export const useStores = () => {
  const [stores, setStores] = useState<Record<StoreKey, Store>>({});
  const [loading, setLoading] = useState(true);
  // 店舗一覧を一度でも正常に受信できたら true。
  // タイムアウトやエラーでは false のまま（「取得できていない」と「店舗が無い」を区別するため）。
  // この名前は他の作業からも参照されるので変えないこと。
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storesRef = ref(db, 'stores');
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
        setLoaded(true);
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

  /** openingDate は YYYY-MM-DD（オープン日）。createdAt として保存する */
  const addStore = useCallback(async (name: string, password: string, openingDate: string) => {
    const createdAt = openingDateToIso(openingDate);
    const key = generateStoreKey();
    const passwordHash = await hashPassword(password, key);
    await update(ref(db, `stores/${key}`), {
      name,
      passwordHash,
      createdAt,
    });
    return key;
  }, []);

    const addStoresBulk = useCallback(
    async (rows: Array<{ name: string; password: string; openingDate?: string }>) => {
      const updates: Record<string, Store> = {};
      await Promise.all(
        rows.map(async (row) => {
          const createdAt = openingDateToIso(row.openingDate || getDateKey(0, new Date()));
          const key = generateStoreKey();
          const passwordHash = await hashPassword(row.password, key);
          updates[`stores/${key}`] = {
            name: row.name,
            passwordHash,
            createdAt,
          };
        }),
      );
      await update(ref(db), updates);
    },
    [],
  );

  /** 店舗名と（指定があれば）オープン日を更新する。openingDate は YYYY-MM-DD */
  const updateStoreName = useCallback(async (key: StoreKey, name: string, openingDate?: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('店舗名を入力してください');
    if (trimmed.length >= 80) throw new Error('店舗名が長すぎます（80文字未満）');
    await update(ref(db, `stores/${key}`), {
      name: trimmed,
      ...(openingDate ? { createdAt: openingDateToIso(openingDate) } : {}),
    });
  }, []);

  const deleteStore = useCallback(async (key: StoreKey) => {
    await remove(ref(db, `stores/${key}`));
  }, []);

  return {
    stores,
    loading,
    loaded,
    error,
    addStore,
    addStoresBulk,
    updateStoreName,
    deleteStore,
  };
};
