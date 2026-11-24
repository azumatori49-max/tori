/**
 * 未提出集計の開始日（この日より前は「未提出」として数えない）。
 *
 * 現時点で参照しているのは HistoryScreen のみ。
 * StoreTopScreen・ViewerScreen・MonthlyReportCard・mcp/domain.js は
 * それぞれ同じ値を個別に持っており、ここへの統一は別パッケージ（集計置換）で行う。
 * そのとき全画面がこのファイルを参照する共通の場所になるので、
 * ファイル名・場所・export 名を変えないこと。
 */
export const MISS_TRACK_START = '2026-07-11';

/** 未提出だった1日ぶん。d=日付キー, c=提出済み枚数, t=必要枚数 */
export interface MissDay {
  d: string;
  c: number;
  t: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** photos（配列またはオブジェクト）に入っている写真の枚数 */
export const countSubmittedPhotos = (raw: unknown): number => {
  if (!raw) return 0;
  const values = Array.isArray(raw) ? raw : typeof raw === 'object' ? Object.values(raw as object) : [];
  return values.filter((x) => typeof x === 'string' && x.length > 0).length;
};

/**
 * 今月の未提出集計の対象日（月初〜昨日。集計開始日より前は含めない。当日は含めない）。
 * todayKey は業務日（朝9時切替）の日付キー。
 */
export const currentMonthTrackKeys = (todayKey: string): string[] => {
  const [y, m, d] = todayKey.split('-').map(Number);
  const out: string[] = [];
  for (let day = 1; day < d; day += 1) {
    const k = `${y}-${pad2(m)}-${pad2(day)}`;
    if (k >= MISS_TRACK_START) out.push(k);
  }
  return out;
};

/**
 * 1店舗ぶんの未提出日を数える。
 * - LINE報告は提出扱い、必要枚数に満たない一部提出は未提出扱い
 * - 店舗のオープン日（createdAt）より前の日は数えない
 */
export const collectMissDays = (
  keys: string[],
  daily: Record<string, { photos?: unknown; viaLine?: boolean } | null | undefined>,
  createdAt: string | undefined,
  target: number,
): MissDay[] => {
  const created = createdAt?.slice(0, 10);
  const out: MissDay[] = [];
  keys.forEach((k) => {
    if (created && k < created) return;
    const sub = daily[k];
    const c = countSubmittedPhotos(sub?.photos);
    if (!(sub?.viaLine || c >= target)) out.push({ d: k, c, t: target });
  });
  return out;
};
