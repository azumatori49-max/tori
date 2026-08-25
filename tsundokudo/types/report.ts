/**
 * 衛生管理メンテナンスレポートのデータモデル
 *
 * 紙／スプレッドシートで運用していた「メンテナンスレポート」を
 * そのままアプリのデータ構造に落とし込んだもの。
 */

/** 作業項目の状況（4段階プルダウン） */
export type ConditionLabel =
  | 'とてもよくできてます'
  | 'よくできてます'
  | '普通'
  | 'できてない';

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
  /** 写真（最大6枚） */
  photos: ReportPhoto[];
  /**
   * 内訳チェック（例: 各種フィルター清掃 → 冷蔵庫/冷凍庫/製氷機）。
   * 写真・状況・備考は親項目で共有する。
   */
  subChecks?: { name: string; checked: boolean }[];
}

/** 害虫の状況（いるかいないか） */
export type PestPresence = '多い' | '少ない' | '見ない';

/** ネズミ駆除（レポート内の記録欄・任意） */
export interface RatControl {
  /** 実施したか */
  done: boolean;
  /** 作業内容（ベイト交換・トラップ設置・侵入口チェックなど） */
  work: string;
  /** 発生状況（多い/少ない/見ない） */
  presence: PestPresence | '';
  /** 写真（枚数無制限） */
  photos: ReportPhoto[];
}

/** 害虫駆除 */
export interface PestControl {
  /** 基本駆除 */
  basic: boolean;
  /** 対抗薬剤使用 */
  antiDrug: boolean;
  /** 強殺虫剤 */
  strongPesticide: boolean;
  /** 害虫の状況（多い/少ない/見ない） */
  presence: PestPresence | '';
  /** 写真（最大6枚） */
  photos: ReportPhoto[];
}

/** トッピング（追加作業）。1レポートにつき複数選択可。 */
export interface ToppingItem {
  name: string;
  checked: boolean;
  comment: string;
  /** 追加費用（円・税抜） */
  fee: number;
}

/** プチDIY項目（自分で追加する。コメント・金額・写真付き） */
export interface DiyItem {
  name: string;
  checked: boolean;
  comment: string;
  /** 追加費用（円・税抜） */
  fee: number;
  /** 写真（最大6枚） */
  photos: ReportPhoto[];
}

/** 年間スケジュール（コメント・追加費用・写真） */
export interface AnnualSchedule {
  comment: string;
  /** 追加費用（円・税抜） */
  fee: number;
  /** 写真（最大6枚） */
  photos: ReportPhoto[];
}

/** 写真の分類 */
export type PhotoCategory = '店舗外観' | '施工前' | '施工中' | '施工後' | 'その他';

/** レポートに添付する写真 */
export interface ReportPhoto {
  id: string;
  /** 画像データ（data URL もしくはファイルURI） */
  uri: string;
  /** 分類 */
  category: PhotoCategory;
  /** 一言メモ */
  caption: string;
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

/** レポートの種類（メンテナンス報告 / オーダー工事報告） */
export type ReportType = 'maintenance' | 'order';

/** 前回からの課題（達成チェック付き） */
export interface IssueItem {
  text: string;
  done: boolean;
}

/** メンテナンスレポート本体 */
export interface MaintenanceReport {
  id: string;
  /** 種類（既定: maintenance）。order はオーダー工事報告 */
  reportType: ReportType;
  /** 請求対応済み（チェックすると一覧で月別グループへ移動） */
  billingDone: boolean;
  /** 作業店舗 */
  storeName: string;
  /** 会社名（例: 株式会社鶏ヤロー）。一覧のフォルダ分けに使用 */
  company: string;
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
  /** ネズミ駆除（任意） */
  ratControl: RatControl;
  /** トッピング */
  toppings: ToppingItem[];
  /** プチDIY */
  diy: DiyItem[];
  /** 使用備品資材 */
  supplies: SupplyLine[];
  /** 添付写真（店舗外観・作業前後など） */
  photos: ReportPhoto[];
  /** 年間スケジュール */
  annualSchedule: AnnualSchedule;
  /** 前回からの課題（前回レポートの「次回の課題」を引き継ぎ、達成をチェック） */
  prevIssues: IssueItem[];
  /** 次回の課題（文章のみ・任意） */
  nextIssues: string[];
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
  /** 会社マスタ */
  companies: string[];
  /** 御請求先マスタ */
  billingTos: string[];
  /** 電球プライスなどの単価メモ（表示用） */
  priceNotes: { label: string; price: number }[];
  /** 初期設定（既定値の入力）を済ませたか（会社登録直後の案内用） */
  setupDone?: boolean;
}
