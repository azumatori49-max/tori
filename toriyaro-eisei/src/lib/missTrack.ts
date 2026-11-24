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
