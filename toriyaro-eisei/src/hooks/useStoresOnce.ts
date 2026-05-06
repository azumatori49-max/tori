import { get, ref } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import type { Store, StoreKey } from '../types';

const CACHE_KEY = 'toriyaro-eisei.stores-cache';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

interface CachePayload {
  ts: number;
  data: Record<StoreKey, Store>;
}

const readCache = (): Record<StoreKey, Store> | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed?.data || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCache = (data: Record<StoreKey, Store>) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* ignore */
  }
};

export const invalidateStoresCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
};

export const useStoresOnce = () => {
  const cached = readCache();
  const [stores, setStores] = useState<Record<StoreKey, Store>>(cached ?? {});
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      const snap = await get(ref(db, 'stores'));
      const data = (snap.val() as Record<StoreKey, Store> | null) ?? {};
      setStores(data);
      writeCache(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('failed to fetch stores'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stores, loading, error, refresh };
};
