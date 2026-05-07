import type { ReportType } from '../types';

export const DAILY_SLOT_LABELS: readonly string[] = [
  'コーラサーバー洗浄',
  'ビールサーバー洗浄',
  'グリスト',
  'フードレンジ',
  'フライヤー',
  '洗剤補充',
  '衛生管理報告',
];

export const WEEKLY_SLOT_LABELS: readonly string[] = [];

export const slotLabelFor = (type: ReportType, index: number): string => {
  const arr = type === 'daily' ? DAILY_SLOT_LABELS : WEEKLY_SLOT_LABELS;
  return arr[index] ?? `スロット ${index + 1}`;
};
