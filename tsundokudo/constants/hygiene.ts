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

/** 状況プルダウンの選択肢 */
export const CONDITION_OPTIONS: ConditionLabel[] = [
  'とても良く出来ています',
  '良く出来ています',
  '普通です',
  '改善が必要です',
  '要対応',
];

/** 定期点検チェックリストの定型項目 */
export const DEFAULT_CHECKLIST_NAMES: string[] = [
  'グリストラップ洗浄',
  'エアコンフィルター洗浄',
  'ビール・コーラサーバー点検清掃',
  '看板電飾点検',
  '店内照明',
  '冷蔵庫フィルター清掃',
  '冷凍庫フィルター清掃',
  '製氷機フィルター清掃',
  'キッチン床閉鎖清掃',
  '厨房換気扇フィルター清掃',
  '入口チャイム確認',
];

/** トッピング（追加作業）の定型項目 */
export const DEFAULT_TOPPING_NAMES: string[] = [
  '粗大ゴミ回収',
  '蛇口の修繕',
  '椅子・テーブルの修繕',
  '排水管高圧洗浄（枝管）',
  'グリスト下流高圧洗浄',
];

/** プチDIYの定型項目 */
export const DEFAULT_DIY_NAMES: string[] = [
  '冷蔵庫パッキン清掃・点検',
  '冷蔵庫パネル清掃',
];

export function makeDefaultChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST_NAMES.map((name) => ({
    name,
    checked: false,
    condition: '',
    note: '',
    nextDate: '',
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

export function makeDefaultDiy(): DiyItem[] {
  return DEFAULT_DIY_NAMES.map((name) => ({
    name,
    checked: false,
    comment: '',
  }));
}

/** 初期設定（マスタ）。スプレッドシートの実例を初期値に。 */
export const DEFAULT_SETTINGS: AppSettings = {
  defaultBillingTo: '株式会社Belief　〒270-0176千葉県流山市加1-1593',
  defaultContractPlan: 'メンテナンス',
  defaultMaintenanceFee: 50000,
  technicians: ['佐藤　真人', '近藤　光蕃'],
  stores: ['まる助東松山駅前店', '池袋店', '歌舞伎町店', '錦糸町店', '秋葉原店'],
  priceNotes: [
    { label: 'E26', price: 260 },
    { label: 'E17', price: 714 },
    { label: 'E11', price: 475 },
    { label: 'EZ10', price: 1082 },
  ],
};

/** 新規レポートの初期値を設定（マスタ）から組み立てる */
export function makeDefaultReport(settings: AppSettings): MaintenanceReportInsert {
  return {
    storeName: '',
    workDate: '',
    contractPlan: settings.defaultContractPlan,
    technician: settings.technicians[0] ?? '',
    billingTo: settings.defaultBillingTo,
    maintenanceFee: settings.defaultMaintenanceFee,
    taxRate: 0.1,
    checklist: makeDefaultChecklist(),
    pestControl: { basic: false, antiDrug: false, strongPesticide: false },
    toppings: makeDefaultToppings(),
    diy: makeDefaultDiy(),
    supplies: [],
    photos: [],
    comment: '',
  };
}
