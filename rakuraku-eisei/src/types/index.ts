export type StoreKey = string;

/** 撮影項目の名称（デイリー/ウィークリー各7つ） */
export interface ReportItems {
  daily: string[];
  weekly: string[];
}

export interface Store {
  name: string;
  /** 店舗ごとの項目名（未設定なら共通設定 settings/reportItems を使う） */
  items?: Partial<ReportItems>;
}

export type ReportType = 'daily' | 'weekly';

export interface Submission {
  count: number;
  submittedAt: string;
  photos: string[];
  storeName: string;
}

export type Screen = 'login' | 'store-top' | 'upload' | 'admin';

export type AdminTab = 'dashboard' | 'stores' | 'items';
export type ReportTab = 'daily' | 'weekly';
export type FilterMode = 'all' | 'ng';

export interface AuthState {
  storeKey: StoreKey | '__admin__' | null;
  isAdmin: boolean;
  /** 閲覧専用（/view）でログイン中か */
  isViewer?: boolean;
}

export type SubmissionStatus = 'submitted' | 'partial' | 'none';

export const getStatus = (count: number): SubmissionStatus => {
  if (count >= 7) return 'submitted';
  if (count > 0) return 'partial';
  return 'none';
};
