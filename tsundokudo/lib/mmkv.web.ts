/**
 * mmkv – Web フォールバック (localStorage)
 *
 * react-native-mmkv は Web 非対応のため、
 * localStorage ベースの互換実装を提供。
 */

const PREFIX = 'tsundokudo:';

const webStorage = {
  getString(key: string): string | undefined {
    return localStorage.getItem(PREFIX + key) ?? undefined;
  },
  set(key: string, value: string | number | boolean): void {
    localStorage.setItem(PREFIX + key, String(value));
  },
  getNumber(key: string): number | undefined {
    const v = localStorage.getItem(PREFIX + key);
    if (v == null) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  },
  getBoolean(key: string): boolean | undefined {
    const v = localStorage.getItem(PREFIX + key);
    if (v == null) return undefined;
    return v === 'true';
  },
  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  },
  clearAll(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  },
};

export const storage = webStorage;

/** キャッシュの有効期限: 5分 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

export const cacheKey = {
  books: (userId: string) => `cache:books:${userId}`,
  booksLastFetched: (userId: string) => `cache:books:${userId}:lastFetched`,
  offlineQueue: (userId: string) => `offlineQueue:${userId}`,
} as const;

export function getCached<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function removeCached(key: string): void {
  storage.remove(key);
}

export function touchLastFetched(key: string): void {
  storage.set(key, Date.now());
}

export function isCacheValid(lastFetchedKey: string): boolean {
  const ts = storage.getNumber(lastFetchedKey);
  if (!ts) return false;
  return Date.now() - ts < CACHE_TTL_MS;
}
