/**
 * 衛生管理メンテナンスレポートのデータモデル
 *
 * 紙／スプレッドシートで運用していた「メンテナンスレポート」を
 * そのままアプリのデータ構造に落とし込んだもの。
 */

/** 作業項目の状況（プルダウン選択肢） */
export type ConditionLabel =
  | 'とても良く出来ています'
  | '良く出来ています'
  | '普通です'
  | '改善が必要です'
  | '要対応';

/** 定期点検チェックリストの1項目 */
export interface ChecklistItem {
  /** 項目名（例: グリストラップ洗浄） */
  name: string;
  /** 作業チェック（実施したか） */
  checked: boolean;
  /** 状況 */
  condition: ConditionLabel | '';
  /** 備考 */
  note: string;
  /** 次回作業予定日（例: 6/14） */
  nextDate: string;
}

/** 害虫駆除 */
export interface PestControl {
  /** 基本駆除 */
  basic: boolean;
  /** 対抗薬剤使用 */
  antiDrug: boolean;
  /** 強殺虫剤 */
  strongPesticide: boolean;
}

/** トッピング（追加作業）。1レポートにつき複数選択可。 */
export interface ToppingItem {
  name: string;
  checked: boolean;
  comment: string;
  /** 追加費用（円・税抜） */
  fee: number;
}

/** プチDIY項目 */
export interface DiyItem {
  name: string;
  checked: boolean;
  comment: string;
}

/** 使用備品資材の明細1行 */
export interface SupplyLine {
  /** 品目（例: ゴミ回収 3立米） */
  name: string;
  /** 単価（円） */
  unitPrice: number;
  /** 数量 */
  qty: number;
}

/** メンテナンスレポート本体 */
export interface MaintenanceReport {
  id: string;
  /** 作業店舗 */
  storeName: string;
  /** 作業日（ISO: YYYY-MM-DD） */
  workDate: string;
  /** 契約プラン（例: メンテナンス） */
  contractPlan: string;
  /** 施工担当者 */
  technician: string;
  /** 御請求先（社名・住所） */
  billingTo: string;

  /** メンテナンス料金（円・税抜） */
  maintenanceFee: number;
  /** 消費税率（例: 0.1） */
  taxRate: number;

  /** 定期点検チェックリスト */
  checklist: ChecklistItem[];
  /** 害虫駆除 */
  pestControl: PestControl;
  /** トッピング */
  toppings: ToppingItem[];
  /** プチDIY */
  diy: DiyItem[];
  /** 使用備品資材 */
  supplies: SupplyLine[];
  /** コメント・提案 */
  comment: string;

  createdAt: string;
  updatedAt: string;
}

/** 新規作成用（id / 日付はストア側で付与） */
export type MaintenanceReportInsert = Omit<
  MaintenanceReport,
  'id' | 'createdAt' | 'updatedAt'
>;

/** 設定（マスタ）。会社情報や担当者・単価表など。 */
export interface AppSettings {
  /** 既定の御請求先 */
  defaultBillingTo: string;
  /** 既定の契約プラン */
  defaultContractPlan: string;
  /** 既定のメンテナンス料金 */
  defaultMaintenanceFee: number;
  /** 担当者一覧 */
  technicians: string[];
  /** 店舗マスタ */
  stores: string[];
  /** 電球プライスなどの単価メモ（表示用） */
  priceNotes: { label: string; price: number }[];
}
