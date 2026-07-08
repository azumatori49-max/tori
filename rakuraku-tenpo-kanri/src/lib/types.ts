export type CheckType = 'daily' | 'weekly'

export interface CheckItem {
  id: string
  name: string
  /** 撮影のヒント（任意） */
  hint?: string
  /** true の場合は複数枚アップロード可＋写真フォルダからの選択可（例: 防犯カメラ） */
  multi?: boolean
  maxPhotos?: number
}

export interface Store {
  id: string
  name: string
  password: string
  active: boolean
  createdAt: number
  /** この店舗で除外する項目ID（例: グリストラップなしの店舗） */
  excludedItemIds?: string[]
  /** この店舗専用の追加項目 */
  customItems?: { daily?: CheckItem[]; weekly?: CheckItem[] }
}

export interface PhotoRecord {
  id: string
  /** 表示用URL（Firebaseは https、デモモードは idb: プレフィックス） */
  url: string
  uploadedAt: number
}

export type ReportedVia = 'app' | 'line' | 'verbal'

export interface Submission {
  storeId: string
  type: CheckType
  /** daily: YYYY-MM-DD（業務日） / weekly: YYYY-Www */
  periodKey: string
  /** itemId -> 写真リスト */
  items: Record<string, PhotoRecord[]>
  /** アプリ外報告（LINE・口頭）のフラグ */
  reportedVia?: ReportedVia
  reportedAt?: number
  updatedAt: number
}

export type SubmissionStatus = 'complete' | 'partial' | 'none' | 'reported'

export interface Feedback {
  id: string
  storeId?: string
  storeName: string
  message: string
  screenshotUrl?: string
  createdAt: number
  reply?: {
    message: string
    createdAt: number
    /** 店舗側が既読にした時刻 */
    readAt?: number
  }
}

export interface ErrorLog {
  id: string
  storeId: string
  storeName: string
  /** 何をしていて失敗したか（例: デイリー 3枚目「まな板」のアップロード） */
  context: string
  message: string
  createdAt: number
}

export interface AppConfig {
  adminPassword: string
  /** 全店共通のチェック項目 */
  defaultItems: { daily: CheckItem[]; weekly: CheckItem[] }
}

export type Role = 'staff' | 'admin' | 'viewer'

export interface SessionData {
  role: Role
  storeId?: string
  storeName?: string
  lastActiveAt: number
}
