import { createMMKV } from 'react-native-mmkv';

// react-native-mmkv v4 では new MMKV() ではなく createMMKV() を使う
export const storage = createMMKV({
  id: 'tsundokudo-storage',
  encryptionKey: 'tsundokudo-secret',
});

/** キャッシュの有効期限: 5分 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------
// キャッシュキービルダー（ユーザーごとに分離）
// ---------------------------------------------------------------
export const cacheKey = {
  books: (userId: string) => `cache:books:${userId}`,
  booksLastFetched: (userId: string) => `cache:books:${userId}:lastFetched`,
  offlineQueue: (userId: string) => `offlineQueue:${userId}`,
} as const;

// ---------------------------------------------------------------
// 汎用ヘルパー
// ---------------------------------------------------------------
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
