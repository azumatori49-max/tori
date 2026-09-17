import type { ReportType, StoreKey } from '../types';
import { getDateKey, getWeekKey } from '../lib/dateUtils';

export interface CheckItem {
  label: string;
  /** 'camera' = 撮影専用 (capture="environment"), 'library' = 写真フォルダから選択可 */
  source: 'camera' | 'library';
  /** true の場合、このスロットは複数枚アップロード可（items 配列の最後でのみ有効） */
  multi?: boolean;
  /** アップロード画面に表示する注意書き */
  note?: string;
  /** アップロード画面に表示する参考写真の public パス（例: "/ref/cola-gas.jpg"） */
  helpImage?: string;
}

export const MARUSUKE_STORE_KEYS = new Set<string>([
  'store_703a0c91',
  'store_4a76043d',
  'store_74982693',
  'store_0826b21e',
  'store_a799bbbb',
  'store_7a2c4dd6',
  'store_654ba2d2',
  'store_b39a9c11',
  'store_f1b8e7de',
]);

const NO_GRIST_STORE_KEYS = new Set<string>([
  'store_4187419d', // 北千住店
  'store_3e6bb520', // 福島栄町店
]);

/** まる助の新項目への切り替え日（この業務日以降は新項目） */
const MARUSUKE_SWITCH_DATE = '2026-07-27';
const MARUSUKE_SWITCH_WEEK = 'W2026-07-27';

/** ガス圧チェック項目の適用開始週（2026-08-31 の週から） */
const GAS_PRESSURE_START_WEEK = 'W2026-08-31';

const COLA_GAS_ITEM: CheckItem = {
  label: 'コーラガス圧（2.0になっているか）',
  source: 'camera',
  note: 'ガス圧計の針が 2.0 を指しているのを確認してから撮影してください。',
  helpImage: '/ref/cola-gas.jpg',
};

const BEER_GAS_ITEM: CheckItem = {
  label: 'ビールガス圧（適正ガス圧になっているか）',
  source: 'camera',
  note: 'ガス圧計が適正範囲にあるのを確認してから撮影してください。',
  helpImage: '/ref/beer-gas.jpg',
};

export const DAILY_ITEMS: CheckItem[] = [
  { label: 'ダスター', source: 'camera' },
  { label: 'まな板', source: 'camera' },
  { label: '洗浄機', source: 'camera' },
  { label: 'ガス元栓', source: 'camera' },
  { label: 'キッチン床', source: 'camera' },
  { label: '冷蔵庫', source: 'camera' },
  { label: 'ジョッキ洗浄機', source: 'camera' },
];

export const WEEKLY_ITEMS: CheckItem[] = [
  { label: 'コーラサーバー洗浄', source: 'camera' },
  { label: 'ビールサーバー洗浄', source: 'camera' },
  { label: 'グリスト', source: 'camera' },
  { label: 'フードレンジ', source: 'camera' },
  { label: 'フライヤー', source: 'camera' },
  { label: '洗剤補充', source: 'camera' },
  { label: '衛生管理報告', source: 'camera' },
  { label: '防犯カメラ', source: 'library', multi: true },
];

export const MONTHLY_ITEMS: CheckItem[] = [
  { label: 'モップ交換', source: 'camera' },
];

/** まる助・旧項目（7/26まで） */
export const MARUSUKE_DAILY_ITEMS: CheckItem[] = [
  { label: 'ガスの元栓', source: 'camera' },
  { label: '炭炉時め', source: 'camera' },
  { label: '食洗機洗浄', source: 'camera' },
  { label: '冷蔵庫吹き上げ', source: 'camera' },
  { label: '床清掃', source: 'camera' },
  { label: 'ダスター漂白', source: 'camera' },
  { label: 'まな板漂白', source: 'camera' },
];

export const MARUSUKE_WEEKLY_ITEMS: CheckItem[] = [
  { label: 'フードレンジ', source: 'camera' },
  { label: 'ビールスポンジ', source: 'camera' },
  { label: '冷蔵庫清掃', source: 'camera' },
  { label: 'グリスト【なければカスターセット全卓】', source: 'camera' },
  { label: 'ダクト', source: 'camera' },
  { label: '衛生管理表', source: 'camera' },
  { label: 'カメラ', source: 'library', multi: true },
];

/** まる助・新項目（7/27から） */
export const MARUSUKE_DAILY_ITEMS_V2: CheckItem[] = [
  { label: 'ガスの元栓', source: 'camera' },
  { label: '炭炉時め', source: 'camera' },
  { label: '食洗機洗浄', source: 'camera' },
  { label: '冷蔵庫内清掃', source: 'camera' },
  { label: '床水流し', source: 'camera' },
  { label: 'ダスター漂白', source: 'camera' },
  { label: 'まな板漂白', source: 'camera' },
];

export const MARUSUKE_WEEKLY_ITEMS_V2: CheckItem[] = [
  { label: 'フードレンジ', source: 'camera' },
  { label: 'ビールスポンジ通しコーラサーバー（あるところ）', source: 'camera' },
  { label: 'バックルーム清掃', source: 'camera' },
  { label: 'グリスト【無ければ炭場掃除】', source: 'camera' },
  { label: 'ダクト清掃', source: 'camera' },
  { label: 'ガスコンロ清掃（焼き）', source: 'camera' },
  { label: '衛生管理表', source: 'camera' },
  { label: 'カメラ画像', source: 'library', multi: true },
];

const isMarusuke = (storeKey?: StoreKey | null): boolean =>
  !!storeKey && MARUSUKE_STORE_KEYS.has(storeKey);

/** ガス圧項目を「衛生管理」項目の直前に挿入して返す。無ければ末尾の multi 項目より前へ挿入 */
const withGasPressure = (
  items: CheckItem[],
  gasItems: CheckItem[] = [COLA_GAS_ITEM, BEER_GAS_ITEM],
): CheckItem[] => {
  const hygieneIdx = items.findIndex((it) => it.label.startsWith('衛生管理'));
  if (hygieneIdx >= 0) {
    return [
      ...items.slice(0, hygieneIdx),
      ...gasItems,
      ...items.slice(hygieneIdx),
    ];
  }
  const last = items[items.length - 1];
  if (last?.multi) {
    return [...items.slice(0, -1), ...gasItems, last];
  }
  return [...items, ...gasItems];
};

export const itemsForType = (
  type: ReportType,
  storeKey?: StoreKey | null,
  dateOrWeekKey?: string,
): CheckItem[] => {
  if (type === 'monthly') {
    return MONTHLY_ITEMS;
  }
  if (isMarusuke(storeKey)) {
    if (type === 'weekly') {
      const key = dateOrWeekKey ?? getWeekKey();
      const base = key >= MARUSUKE_SWITCH_WEEK
        ? MARUSUKE_WEEKLY_ITEMS_V2
        : MARUSUKE_WEEKLY_ITEMS;
      // まる助はコーラが無い店舗のため、ビール圧のみ追加
      return key >= GAS_PRESSURE_START_WEEK ? withGasPressure(base, [BEER_GAS_ITEM]) : base;
    }
    const key = dateOrWeekKey ?? getDateKey();
    return key >= MARUSUKE_SWITCH_DATE
      ? MARUSUKE_DAILY_ITEMS_V2
      : MARUSUKE_DAILY_ITEMS;
  }
  if (type === 'weekly') {
    const key = dateOrWeekKey ?? getWeekKey();
    const base = storeKey && NO_GRIST_STORE_KEYS.has(storeKey)
      ? WEEKLY_ITEMS.filter((it) => it.label !== 'グリスト')
      : WEEKLY_ITEMS;
    return key >= GAS_PRESSURE_START_WEEK ? withGasPressure(base) : base;
  }
  return DAILY_ITEMS;
};

export const targetForType = (
  type: ReportType,
  storeKey?: StoreKey | null,
  dateOrWeekKey?: string,
): number => itemsForType(type, storeKey, dateOrWeekKey).length;