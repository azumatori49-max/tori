import type { ReportType } from '../types';

export interface CheckItem {
  label: string;
  /** 'camera' = 撮影専用 (capture="environment"), 'library' = 写真フォルダから選択可 */
  source: 'camera' | 'library';
}

export const DAILY_ITEMS: CheckItem[] = [
  { label: 'コーラサーバー洗浄', source: 'camera' },
  { label: 'ビールサーバー洗浄', source: 'camera' },
  { label: 'グリスト', source: 'camera' },
  { label: 'フードレンジ', source: 'camera' },
  { label: 'フライヤー', source: 'camera' },
  { label: '洗剤補充', source: 'camera' },
  { label: '衛生管理報告', source: 'camera' },
];

export const WEEKLY_ITEMS: CheckItem[] = [
  ...DAILY_ITEMS,
  { label: '防犯カメラ', source: 'library' },
];

export const itemsForType = (type: ReportType): CheckItem[] =>
  type === 'weekly' ? WEEKLY_ITEMS : DAILY_ITEMS;

export const targetForType = (type: ReportType): number =>
  itemsForType(type).length;
