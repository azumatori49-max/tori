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

export const WEEKLY_SLOT_LABELS: readonly string[] = [
  'コーラサーバー洗浄',
  'ビールサーバー洗浄',
  'グリスト',
  'フードレンジ',
  'フライヤー',
  '洗剤補充',
  '衛生管理報告',
  '防犯カメラ',
];

const LABELS: Record<ReportType, readonly string[]> = {
  daily: DAILY_SLOT_LABELS,
  weekly: WEEKLY_SLOT_LABELS,
};

const PHOTO_INDICES: Record<ReportType, readonly number[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekly: [7],
};

export const slotCountFor = (type: ReportType): number => LABELS[type].length;

export const slotLabelFor = (type: ReportType, index: number): string =>
  LABELS[type][index] ?? `スロット ${index + 1}`;

export const slotIsPhoto = (type: ReportType, index: number): boolean =>
  PHOTO_INDICES[type].includes(index);
