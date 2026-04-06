import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'tsundokudo-storage',
  encryptionKey: 'tsundokudo-secret',
});

export const CACHE_KEYS = {
  BOOKS: 'cache:books',
  BOOKS_LAST_FETCHED: 'cache:books:lastFetched',
  OFFLINE_QUEUE: 'offlineQueue',
} as const;

/** キャッシュの有効期限: 5分 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

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
  storage.delete(key);
}

export function isCacheValid(lastFetchedKey: string): boolean {
  const lastFetched = storage.getNumber(lastFetchedKey);
  if (!lastFetched) return false;
  return Date.now() - lastFetched < CACHE_TTL_MS;
}
