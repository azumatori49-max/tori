export type StoreKey = string;

/** Stored shape in Firebase. */
export interface Store {
  name: string;
  passwordHash: string;
  createdAt?: string;
}

export type ReportType = 'daily' | 'weekly' | 'monthly';

export interface Submission {
  count: number;
  submittedAt: string;
  photos: string[];
  storeName: string;
  viaLine?: boolean;
  photoMeta?: Record<string, { uploadedAt: string }>;
}

export type Screen =
  | 'login'
  | 'store-top'
  | 'upload'
  | 'admin'
  | 'history'
  | 'viewer'
  | 'referral-form'
  | 'schedule-upload';
export type AdminTab = 'dashboard' | 'stores' | 'feedback' | 'referrals' | 'schedules';

// ============================================================
// 年間スケジュール（本部が作る期間つきの撮影依頼）
// ============================================================

/**
 * 参考動画。youtube / vimeo は埋め込み用URL（動画IDから組み立て）、
 * upload は Storage の schedule-media/{scheduleId}/ にあるファイル。
 * 写真の枠番号とは無関係なので、提出済みでも自由に変更できる。
 */
export interface ScheduleVideo {
  type: 'youtube' | 'vimeo' | 'upload';
  url: string;
  /** upload のときの Storage パス（差し替え・削除時に消すため） */
  path?: string;
  /** 表示名（40字まで） */
  title?: string;
  /** upload のときのバイト数 */
  size?: number;
}

export interface ScheduleItem {
  /** 項目名（1〜40字） */
  label: string;
  /** 提出済みとみなす最低枚数（1以上） */
  required: number;
  /** 送れる上限枚数（required 以上） */
  max: number;
  /** 'camera' = 撮影のみ, 'library' = 写真フォルダも可, 'video' = 動画（撮影・フォルダ可、1枠1本） */
  source: 'camera' | 'library' | 'video';
  /** 注意書き（200字まで） */
  note?: string;
  /** 参考画像のURL（Storage の schedule-refs/{scheduleId}/ にアップロードしたもの） */
  helpImage?: string;
  /** この項目の参考動画 */
  video?: ScheduleVideo;
  /**
   * この項目を表示する店舗。無ければスケジュールの対象店舗すべて。
   * 写真の番号は全項目で通しなので、店舗ごとに項目を絞っても番号はずれない。
   */
  stores?: Record<StoreKey, true>;
}

/** DB の schedules/{id}。id は 'W' + 開始日 + '-' + 英数6文字 */
export interface Schedule {
  title: string;
  description?: string;
  /** 業務日 YYYY-MM-DD（両端を含む） */
  from: string;
  to: string;
  /** 対象店舗。無ければ全店 */
  stores?: Record<StoreKey, true>;
  /** 項目。"0","1",… のキー（Firebase の都合で配列で返ることもある） */
  items: Record<string, ScheduleItem> | ScheduleItem[];
  /** スケジュール全体の参考動画 */
  video?: ScheduleVideo;
  archived?: boolean;
  createdAt: string;
}
export type ReportTab = 'daily' | 'weekly' | 'monthly';
export type FilterMode = 'all' | 'ng';

export interface AuthState {
  storeKey: StoreKey | '__admin__' | null;
  isAdmin: boolean;
}

// ============================================================
// 紹介手当申請 (referral bonus)
// ============================================================

/** 社員紹介＝3ヶ月勤務達成 / スタッフ紹介＝50時間勤務達成 */
export type ReferralKind = 'employee' | 'staff';

export type ReferralStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface ReferralSignature {
  imageUrl: string;
  signedAt: string;
}

export interface ReferralChecklist {
  enrolled: boolean;
  hireDate: boolean;
  threshold: boolean;
}

/** 下書き（送信前の途中保存）。サイン画像は base64 dataURL のまま RTDB に保存。
 *  本送信のタイミングで Storage へアップロードして referralRequests に昇格する */
export interface ReferralDraft {
  id: string;
  storeKey: StoreKey;
  kind: ReferralKind;
  managerName: string;
  referrerName: string;
  referredName: string;
  hireDate: string;
  thresholdDate: string;
  signatures: {
    manager?: { dataUrl: string; signedAt: string };
    referrer?: { dataUrl: string; signedAt: string };
    referred?: { dataUrl: string; signedAt: string };
  };
  updatedAt: string;
}

export interface ReferralRequest {
  id: string;
  kind: ReferralKind;
  storeKey: StoreKey;
  storeName: string;
  managerName: string;
  referrerName: string;
  referredName: string;
  /** 空白除去＋カタカナ→ひらがな化した被紹介者名（重複検知用） */
  normalizedReferredName: string;
  /** YYYY-MM-DD */
  hireDate: string;
  /** YYYY-MM-DD */
  thresholdDate: string;
  signatures: {
    manager: ReferralSignature;
    referrer: ReferralSignature;
    referred: ReferralSignature;
  };
  appliedAt: string;
  status: ReferralStatus;
  rejectReason?: string;
  checklist?: ReferralChecklist;
  decidedBy?: string;
  decidedAt?: string;
  paidAt?: string;
}
