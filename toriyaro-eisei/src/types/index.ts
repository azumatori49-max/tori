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
  | 'referral-form';
export type AdminTab = 'dashboard' | 'stores' | 'feedback' | 'referrals';
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
