/** 端末内（IndexedDB）の送信キュー。通信不能でも記録を失わないための保存層 */

export type QueueState = 'draft' | 'pending' | 'syncing' | 'synced' | 'failed';

export interface QueueSlot {
  index: number;
  /** 既存写真をそのまま使う場合のURL */
  existingUrl?: string;
  /** 未送信の写真データ（送信完了後に削除して容量節約） */
  blob?: Blob;
　  /** 未送信の写真データ（iOS対策のArrayBuffer形式・推奨） */
  data?: ArrayBuffer;
  /** アップロード成功後のURL（再送時はアップロードをスキップ） */
  uploadedUrl?: string;
}

export interface QueueRecord {
  id: string; // UUID（再送しても二重登録されない鍵）
  tenantId: string;
  storeId: string;
  storeName: string;
  type: 'daily' | 'weekly';
  dateOrWeekKey: string;
  slots: QueueSlot[];
  state: QueueState;
  createdAt: string; // 入力日時
  savedAt: string; // 端末保存日時
  syncedAt?: string; // サーバー保存確認日時
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'rakuraku-offline';
const STORE = 'outbox';

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const withStore = <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    openDb()
      .then((db) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
      .catch(reject);
  });

export const saveRecord = (rec: QueueRecord): Promise<unknown> =>
  withStore('readwrite', (s) => s.put(rec));

export const getRecord = (id: string): Promise<QueueRecord | undefined> =>
  withStore('readonly', (s) => s.get(id));

export const listAll = (): Promise<QueueRecord[]> =>
  withStore('readonly', (s) => s.getAll());

/** 未送信（送信待ち・失敗・中断された送信中）の一覧 */
export const listUnsynced = async (): Promise<QueueRecord[]> => {
  const all = await listAll();
  return all.filter(
    (r) => r.state === 'pending' || r.state === 'failed' || r.state === 'syncing',
  );
};

export const countUnsynced = async (): Promise<number> =>
  (await listUnsynced()).length;

export const deleteRecord = (id: string): Promise<unknown> =>
  withStore('readwrite', (s) => s.delete(id));

/** 送信済みレコードの掃除（7日経過で削除・容量節約） */
export const cleanupSynced = async (days = 7): Promise<void> => {
  const all = await listAll();
  const limit = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  for (const r of all) {
    if (r.state === 'synced' && r.syncedAt && r.syncedAt < limit) {
      await deleteRecord(r.id);
    }
  }
};