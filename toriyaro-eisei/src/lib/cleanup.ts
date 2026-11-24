import { get, onValue, ref, remove } from 'firebase/database';
import { listAll, ref as storageRef, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import { dateKeyToDate, weekKeyToDate } from './dateUtils';

/**
 * 自動クリーンアップ（90日より古い提出の削除）の有効/無効。
 *
 * 現在は一時停止中（false）。
 * 理由: 90日削除が月次レポート／過去の提出の「未提出」判定と衝突する。
 *       集計開始日 2026-07-11 の記録が 2026-10-09 頃から消え始め、
 *       消えた日は「未提出」として数えられてしまう。
 * 再開条件: 提出の有無を写真とは別に保持する「集計記録」の仕組みが入り、
 *           写真を消しても未提出判定に影響しなくなったら true に戻す。
 * 注意: この定数名は他の作業からも参照されるので変えないこと。
 */
export const CLEANUP_ENABLED = false;

const RETENTION_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LAST_RUN_STORAGE_KEY = 'toriyaro-eisei.cleanup.lastRunAt';

/** サーバー時刻との差がこれを超えていたら端末の時計が狂っているとみなし、削除しない */
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;
/** サーバー時刻オフセットの取得を待つ上限（オフライン時は値が来ない） */
const SERVER_OFFSET_TIMEOUT_MS = 10_000;

export interface CleanupResult {
  inspected: number;
  deleted: number;
  storageFilesDeleted: number;
  errors: number;
  /** 基準時刻を確定できず、何も削除せずに終えたとき true */
  skipped?: boolean;
}

/**
 * 保持期限を過ぎているか。
 * - monthly は常に false（保持）。月キー "M2026-08" は dateKeyToDate で NaN になり
 *   結果的に永久に残っていたが、月次は集計記録の別パッケージまで意図して保持する。
 * - daily / weekly 以外、日付が解釈できない（NaN）ものも false。
 * 挙動確認用に export している（呼び出し側の動きは変えない）。
 */
export const isOlderThanRetention = (
  type: string,
  key: string,
  cutoffMs: number,
): boolean => {
  if (type === 'monthly') return false;
  if (type !== 'daily' && type !== 'weekly') return false;
  try {
    const d = type === 'weekly' ? weekKeyToDate(key) : dateKeyToDate(key);
    const t = d.getTime();
    if (Number.isNaN(t)) return false;
    return t < cutoffMs;
  } catch {
    return false;
  }
};

/**
 * サーバー時刻と端末時刻の差（ミリ秒）を取得する。
 * .info/serverTimeOffset は get() では読めない（"Invalid token in path" で失敗する）ため
 * onValue(onlyOnce) で読む。時間内に値が来なければ null（取得失敗）。
 */
const fetchServerTimeOffset = (): Promise<number | null> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (v: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsub();
      resolve(v);
    };
    const timer = window.setTimeout(() => finish(null), SERVER_OFFSET_TIMEOUT_MS);
    const unsub = onValue(
      ref(db, '.info/serverTimeOffset'),
      (snap) => {
        const v = snap.val();
        finish(typeof v === 'number' && Number.isFinite(v) ? v : null);
      },
      () => finish(null),
      { onlyOnce: true },
    );
  });

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
  // 基準時刻はサーバー時刻（端末の時計が狂っていても消しすぎない）。
  // 取得できない、または差が大きすぎる場合は何も削除しない。
  const offset = await fetchServerTimeOffset();
  if (offset === null || Math.abs(offset) > MAX_CLOCK_SKEW_MS) {
    result.skipped = true;
    return result;
  }
  const serverNow = Date.now() + offset;
  const cutoffMs = serverNow - RETENTION_DAYS * MS_PER_DAY;

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
  if (!CLEANUP_ENABLED) return null;
  if (typeof window === 'undefined') return null;
  try {
    const lastRaw = window.localStorage.getItem(LAST_RUN_STORAGE_KEY);
    const last = lastRaw ? Number(lastRaw) : 0;
    if (Number.isFinite(last) && Date.now() - last < MS_PER_DAY) {
      return null;
    }
    const result = await purgeExpiredSubmissions();
    // 基準時刻を確定できずスキップしたときは lastRunAt を更新しない（次回に再試行）
    if (!result.skipped) {
      window.localStorage.setItem(LAST_RUN_STORAGE_KEY, String(Date.now()));
    }
    return result;
  } catch {
    return null;
  }
};
