import type { ReportType } from '../types';

export type SlotInputMode = 'camera' | 'gallery';

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

export const slotCountFor = (type: ReportType): number => LABELS[type].length;

export const slotLabelFor = (type: ReportType, index: number): string =>
  LABELS[type][index] ?? `スロット ${index + 1}`;

export const slotInputMode = (type: ReportType, index: number): SlotInputMode => {
  if (type === 'weekly' && index === 7) return 'gallery';
  return 'camera';
};
