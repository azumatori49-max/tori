export type StoreKey = string;

export interface Store {
  name: string;
  password: string;
}

export type ReportType = 'daily' | 'weekly';

export interface Submission {
  count: number;
  submittedAt: string;
  photos: string[];
  storeName: string;
}

export type Screen = 'login' | 'store-top' | 'upload' | 'admin';

export type AdminTab = 'dashboard' | 'stores';
export type ReportTab = 'daily' | 'weekly';
export type FilterMode = 'all' | 'ng';

export type AdminKey = '__admin__';

export interface AuthState {
  storeKey: StoreKey | AdminKey | null;
  isAdmin: boolean;
}

export type SubmissionStatus = 'submitted' | 'partial' | 'none';
