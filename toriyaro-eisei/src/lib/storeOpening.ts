import type { ReportType } from '../types';

/**
 * 画面で入力したオープン日（YYYY-MM-DD）を、stores/{key}/createdAt に入れる形（UTC 0時の ISO 文字列）に直す。
 * 不正な日付は例外にする。
 */
export const openingDateToIso = (dateKey: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey < '1900-01-01') {
    throw new Error('オープン日を正しい日付で入力してください');
  }
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== dateKey) {
    throw new Error('オープン日を正しい日付で入力してください');
  }
  return d.toISOString();
};

/**
 * その店舗が、表示中の日・週・月の時点でオープン済みか（提出確認の一覧に出すかどうか）。
 * - オープン日が未設定なら常に対象
 * - オープン日が今日より先（事前登録）の店舗は対象外
 * - 週はその週の日曜まで、月はその月のうちにオープンしていれば対象
 */
export const isStoreOpenFor = (
  createdAt: string | undefined,
  type: ReportType,
  key: string,
  todayKey: string,
): boolean => {
  const opened = createdAt?.slice(0, 10);
  if (!opened) return true;
  if (opened > todayKey) return false;
  if (type === 'monthly') return opened.slice(0, 7) <= key.slice(1);
  if (type === 'weekly') {
    const sunday = new Date(`${key.slice(1)}T00:00:00.000Z`);
    sunday.setUTCDate(sunday.getUTCDate() + 6);
    return opened <= sunday.toISOString().slice(0, 10);
  }
  return opened <= key;
};
