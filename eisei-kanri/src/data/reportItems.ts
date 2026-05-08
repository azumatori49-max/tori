import type { ReportType } from '../types';

export interface SlotConfig {
  label: string;
  galleryAllowed?: boolean;
}

export const DAILY_SLOTS: SlotConfig[] = [
  { label: 'コーラサーバー洗浄' },
  { label: 'ビールサーバー洗浄' },
  { label: 'グリスト' },
  { label: 'フードレンジ' },
  { label: 'フライヤー' },
  { label: '洗剤補充' },
  { label: '衛生管理報告' },
];

export const WEEKLY_SLOTS: SlotConfig[] = [
  ...DAILY_SLOTS,
  { label: '防犯カメラ', galleryAllowed: true },
];

export const getSlots = (type: ReportType): SlotConfig[] =>
  type === 'daily' ? DAILY_SLOTS : WEEKLY_SLOTS;

export const getSlotCount = (type: ReportType): number => getSlots(type).length;
