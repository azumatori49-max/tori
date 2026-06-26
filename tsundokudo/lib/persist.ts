/**
 * 永続化レイヤー（非同期 Key-Value）
 *
 * - Web: IndexedDB を使用（localStorage の約5MB制限を回避。写真base64も保存可）
 *        旧localStorage(mmkv.web)のデータがあれば自動移行する
 * - ネイティブ: MMKV（大容量データも扱える）を Promise でラップ
 */
import { Platform } from 'react-native';

import { storage } from '@/lib/mmkv';

export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// ---------------------------------------------------------------
// ネイティブ（MMKV）
// ---------------------------------------------------------------
const nativeKV: KV = {
  getItem: (k) => Promise.resolve(storage.getString(k) ?? null),
  setItem: (k, v) => {
    storage.set(k, v);
    return Promise.resolve();
  },
  removeItem: (k) => {
    storage.remove(k);
    return Promise.resolve();
  },
};

// ---------------------------------------------------------------
// Web（IndexedDB）
// ---------------------------------------------------------------
const DB_NAME = 'eisei-report';
const STORE_NAME = 'kv';
/** 旧localStorage(mmkv.web)のキープレフィックス */
const LEGACY_PREFIX = 'tsundokudo:';

let dbPromise: Promise<IDBDatabase> | null = null;

/** DOMException 等を name を保ったまま Error に変換する */
function toError(e: DOMException | null, fallback: string): Error {
  const err = new Error(e?.message ?? fallback);
  if (e?.name) err.name = e.name; // QuotaExceededError 等を保持
  return err;
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(toError(req.error, 'IndexedDB open failed'));
  });
  return dbPromise;
}

function idbRequest<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const req = fn(tx.objectStore(STORE_NAME));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(toError(req.error, 'IndexedDB request failed'));
      }),
  );
}

const webKV: KV = {
  async getItem(key) {
    const value = await idbRequest<string | undefined>('readonly', (s) => s.get(key));
    if (value != null) return value;
    // 旧localStorageからの移行（初回のみ）
    try {
      const legacy = localStorage.getItem(LEGACY_PREFIX + key);
      if (legacy != null) {
        await webKV.setItem(key, legacy);
        return legacy;
      }
    } catch {
      // localStorage 不可環境は無視
    }
    return null;
  },
  async setItem(key, value) {
    await idbRequest('readwrite', (s) => s.put(value, key));
  },
  async removeItem(key) {
    await idbRequest('readwrite', (s) => s.delete(key));
  },
};

export const persist: KV = Platform.OS === 'web' ? webKV : nativeKV;
