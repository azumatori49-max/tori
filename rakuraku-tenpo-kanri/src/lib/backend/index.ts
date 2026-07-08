import type {
  AppConfig,
  CheckItem,
  CheckType,
  ErrorLog,
  Feedback,
  PhotoRecord,
  ReportedVia,
  Store,
  Submission,
} from '../types'

/**
 * データ層の抽象化
 * - LocalBackend: Firebase 未設定でも全機能を試せるデモモード（IndexedDB + localStorage）
 * - FirebaseBackend: 本番用（Realtime Database + Storage + 匿名認証）
 * 環境変数 VITE_FIREBASE_API_KEY があれば自動的に Firebase に接続します。
 */
export interface Backend {
  readonly isDemo: boolean

  getConfig(): Promise<AppConfig>
  setAdminPassword(password: string): Promise<void>
  setDefaultItems(type: CheckType, items: CheckItem[]): Promise<void>

  listStores(): Promise<Store[]>
  saveStore(store: Store): Promise<void>
  deleteStore(storeId: string): Promise<void>

  getSubmission(type: CheckType, periodKey: string, storeId: string): Promise<Submission | null>
  listSubmissions(type: CheckType, periodKey: string): Promise<Record<string, Submission>>
  /** 写真を1枚アップロードして提出データに追記（1枚ごとの途中保存） */
  uploadPhoto(params: {
    type: CheckType
    periodKey: string
    storeId: string
    itemId: string
    blob: Blob
    /** multi 項目は追記、それ以外は差し替え */
    append: boolean
  }): Promise<PhotoRecord>
  deletePhoto(
    type: CheckType,
    periodKey: string,
    storeId: string,
    itemId: string,
    photoId: string,
  ): Promise<void>
  /** 提出を別の日付/週へ移動（管理者のデータ修正） */
  moveSubmission(
    type: CheckType,
    fromKey: string,
    toKey: string,
    storeId: string,
  ): Promise<void>
  /** LINE・口頭報告を提出済み扱いにする */
  markReported(
    type: CheckType,
    periodKey: string,
    storeId: string,
    via: ReportedVia | null,
  ): Promise<void>

  submitFeedback(fb: Omit<Feedback, 'id' | 'createdAt'>, screenshot?: Blob): Promise<void>
  listFeedback(): Promise<Feedback[]>
  replyFeedback(feedbackId: string, message: string): Promise<void>
  markFeedbackRead(feedbackId: string): Promise<void>

  logError(log: Omit<ErrorLog, 'id' | 'createdAt'>): Promise<void>
  listErrorLogs(): Promise<ErrorLog[]>

  /** retentionDays より古い提出・ログを削除。削除件数を返す */
  cleanupOldData(retentionDays: number): Promise<number>
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

let backendPromise: Promise<Backend> | null = null

export function getBackend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      if (import.meta.env.VITE_FIREBASE_API_KEY) {
        const { FirebaseBackend } = await import('./firebase')
        return new FirebaseBackend()
      }
      const { LocalBackend } = await import('./local')
      return new LocalBackend()
    })()
  }
  return backendPromise
}

/** 店舗に適用されるチェック項目リストを解決（除外・独自項目を反映） */
export function resolveItems(
  config: AppConfig,
  store: Store | undefined,
  type: CheckType,
): CheckItem[] {
  const base = config.defaultItems[type] ?? []
  if (!store) return base
  const excluded = new Set(store.excludedItemIds ?? [])
  const items = base.filter((i) => !excluded.has(i.id))
  return [...items, ...(store.customItems?.[type] ?? [])]
}
