import { get, ref, remove } from 'firebase/database';
import { listAll, ref as storageRef, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { dateKeyToDate, weekKeyToDate } from './dateUtils';

const RETENTION_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LAST_RUN_STORAGE_KEY = 'toriyaro-eisei.cleanup.lastRunAt';

export interface CleanupResult {
  inspected: number;
  deleted: number;
  storageFilesDeleted: number;
  errors: number;
}

const isOlderThanRetention = (
  type: string,
  key: string,
  cutoffMs: number,
): boolean => {
  try {
    const d = type === 'weekly' ? weekKeyToDate(key) : dateKeyToDate(key);
    return d.getTime() < cutoffMs;
  } catch {
    return false;
  }
};

/**
 * 90日より古い submissions を Storage と RTDB の両方から削除する。
 * 管理者画面の表示時に呼び出される（同日中に一度しか走らない）。
 */
export const purgeExpiredSubmissions = async (): Promise<CleanupResult> => {
  const result: CleanupResult = {
    inspected: 0,
    deleted: 0,
    storageFilesDeleted: 0,
    errors: 0,
  };
  const cutoffMs = Date.now() - RETENTION_DAYS * MS_PER_DAY;

  let snap;
  try {
    snap = await get(ref(db, 'submissions'));
  } catch {
    result.errors += 1;
    return result;
  }
  const all = (snap.val() ?? {}) as Record<
    string,
    Record<string, Record<string, unknown>>
  >;

  for (const storeKey of Object.keys(all)) {
    const types = all[storeKey] ?? {};
    for (const type of Object.keys(types)) {
      const dates = types[type] ?? {};
      for (const dateKey of Object.keys(dates)) {
        result.inspected += 1;
        if (!isOlderThanRetention(type, dateKey, cutoffMs)) continue;

        // Storage 側: photos/{storeKey}/{type}/{dateKey}/ 配下を全部消す
        try {
          const folderRef = storageRef(storage, `photos/${storeKey}/${type}/${dateKey}`);
          const listing = await listAll(folderRef);
          await Promise.all(
            listing.items.map(async (item) => {
              try {
                await deleteObject(item);
                result.storageFilesDeleted += 1;
              } catch {
                result.errors += 1;
              }
            }),
          );
        } catch {
          // フォルダが存在しない等は無視
        }

        // RTDB 側: 提出レコードを削除
        try {
          await remove(ref(db, `submissions/${storeKey}/${type}/${dateKey}`));
          result.deleted += 1;
        } catch {
          result.errors += 1;
        }
      }
    }
  }
  return result;
};

/**
 * 1日1回まで自動でクリーンアップを走らせる。複数のブラウザから同時に走っても害は無い
 * （remove は冪等）が、無駄を避けるため localStorage で抑制する。
 */
export const maybeRunDailyCleanup = async (): Promise<CleanupResult | null> => {
  if (typeof window === 'undefined') return null;
  try {
    const lastRaw = window.localStorage.getItem(LAST_RUN_STORAGE_KEY);
    const last = lastRaw ? Number(lastRaw) : 0;
    if (Number.isFinite(last) && Date.now() - last < MS_PER_DAY) {
      return null;
    }
    const result = await purgeExpiredSubmissions();
    window.localStorage.setItem(LAST_RUN_STORAGE_KEY, String(Date.now()));
    return result;
  } catch {
    return null;
  }
};
