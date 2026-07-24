/**
 * 衛生管理レポートの初期テンプレート・選択肢
 *
 * スプレッドシートの定型項目をそのまま定数化している。
 */
import type {
  AppSettings,
  ChecklistItem,
  ConditionLabel,
  DiyItem,
  MaintenanceReportInsert,
  ToppingItem,
} from '@/types/report';

/** 状況プルダウンの選択肢（4段階） */
export const CONDITION_OPTIONS: ConditionLabel[] = [
  'とてもよくできてます',
  'よくできてます',
  '普通',
  'できてない',
];

/** 写真の添付を任意にする定期点検の項目名 */
export const OPTIONAL_PHOTO_CHECK_NAMES: string[] = [
  'グリストラップ洗浄',
  '厨房換気扇フィルター清掃',
  '入口チャイム確認',
];

/** まとめ項目「各種フィルター清掃」の内訳（1枚の写真にまとめて撮影する運用） */
export const FILTER_GROUP_NAME = '各種フィルター清掃';
export const FILTER_SUB_CHECKS: string[] = [
  '冷蔵庫フィルター清掃',
  '冷凍庫フィルター清掃',
  '製氷機フィルター清掃',
];

/** 定期点検チェックリストの定型項目 */
export const DEFAULT_CHECKLIST_NAMES: string[] = [
  'グリストラップ洗浄',
  'エアコンフィルター洗浄',
  '看板電飾点検',
  '店内照明',
  FILTER_GROUP_NAME,
  'キッチン床閉鎖清掃',
  '厨房換気扇フィルター清掃',
  '入口チャイム確認',
];

/** トッピング（追加施工）の定型項目 */
export const DEFAULT_TOPPING_NAMES: string[] = [
  '粗大ゴミ回収',
  '蛇口の修繕',
  '椅子・テーブルの修繕',
  '排水管高圧洗浄（枝管）',
  'グリスト下流高圧洗浄',
];

/** 害虫の状況（いるかいないか）の選択肢 */
export const PEST_PRESENCE_OPTIONS = ['多い', '少ない', '見ない'] as const;

export function makeDefaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_NAMES.map((name) => ({
    name,
    checked: false,
    condition: '',
    note: '',
    photos: [],
    ...(name === FILTER_GROUP_NAME
      ? { subChecks: FILTER_SUB_CHECKS.map((n) => ({ name: n, checked: false })) }
      : {}),
  }));
}

export function makeDefaultToppings(): ToppingItem[] {
  return DEFAULT_TOPPING_NAMES.map((name) => ({
    name,
    checked: false,
    comment: '',
    fee: 0,
  }));
}

/** プチDIYは自分で追加する方式のため初期は空 */
export function makeDefaultDiy(): DiyItem[] {
  return [];
}

/**
 * 初期設定（マスタ）。
 * 新規のお客様（会社）ごとに自分で設定するため空から始める。
 * 値は設定画面で編集でき、レポート作成時にも自動で追加される。
 */
export const DEFAULT_SETTINGS: AppSettings = {
  defaultBillingTo: '',
  defaultContractPlan: 'メンテナンス',
  defaultMaintenanceFee: 0,
  technicians: [],
  stores: [],
  companies: [],
  billingTos: [],
  priceNotes: [],
};

/** 新規レポートの初期値を設定（マスタ）から組み立てる */
export function makeDefaultReport(settings: AppSettings): MaintenanceReportInsert {
  return {
    reportType: 'maintenance',
    storeName: '',
    company: '',
    workDate: '',
    contractPlan: settings.defaultContractPlan,
    technician: settings.technicians[0] ?? '',
    billingTo: settings.defaultBillingTo,
    maintenanceFee: settings.defaultMaintenanceFee,
    taxRate: 0.1,
    checklist: makeDefaultChecklist(),
    pestControl: {
      basic: false,
      antiDrug: false,
      strongPesticide: false,
      presence: '',
      photos: [],
    },
    toppings: makeDefaultToppings(),
    diy: makeDefaultDiy(),
    supplies: [],
    photos: [],
    annualSchedule: { comment: '', fee: 0, photos: [] },
    prevIssues: [],
    nextIssues: [],
    comment: '',
  };
}
