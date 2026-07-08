import { initializeApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
} from 'firebase/auth'
import {
  child,
  get,
  getDatabase,
  ref,
  remove,
  set,
  update,
  type Database,
} from 'firebase/database'
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage'
import { mondayOfWeek, parseDateKey } from '../businessDay'
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
import type { Backend } from './index'
import { newId } from './index'
import { DEFAULT_CONFIG } from './seed'

/**
 * 本番用バックエンド（Firebase Realtime Database + Storage + 匿名認証）
 *
 * データ構造:
 *   config                         … 管理者パスワード・共通チェック項目
 *   stores/{storeId}               … 店舗マスタ
 *   submissions/{type}/{periodKey}/{storeId} … 提出データ
 *   feedback/{id}                  … フィードバック
 *   errorLogs/{id}                 … 自動エラーログ
 * Storage:
 *   photos/{type}/{periodKey}/{storeId}/{itemId}/{photoId}.jpg
 *   feedback/{id}.jpg
 */
export class FirebaseBackend implements Backend {
  readonly isDemo = false
  private db: Database
  private storage: FirebaseStorage
  private auth: Auth
  private authReady: Promise<void>

  constructor() {
    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    })
    this.db = getDatabase(app)
    this.storage = getStorage(app)
    this.auth = getAuth(app)
    this.authReady = this.signIn()
    // 認証切れの自動復旧
    onAuthStateChanged(this.auth, (user) => {
      if (!user) this.authReady = this.signIn()
    })
  }

  private async signIn(): Promise<void> {
    await signInAnonymously(this.auth)
  }

  private async ensureAuth(): Promise<void> {
    await this.authReady
    if (!this.auth.currentUser) {
      this.authReady = this.signIn()
      await this.authReady
    }
  }

  async getConfig(): Promise<AppConfig> {
    await this.ensureAuth()
    const snap = await get(ref(this.db, 'config'))
    if (!snap.exists()) {
      // 初回起動時にデフォルト設定を投入
      await set(ref(this.db, 'config'), DEFAULT_CONFIG)
      return DEFAULT_CONFIG
    }
    const raw = snap.val() as Partial<AppConfig>
    return {
      adminPassword: raw.adminPassword ?? DEFAULT_CONFIG.adminPassword,
      defaultItems: {
        daily: raw.defaultItems?.daily ?? DEFAULT_CONFIG.defaultItems.daily,
        weekly: raw.defaultItems?.weekly ?? DEFAULT_CONFIG.defaultItems.weekly,
      },
    }
  }

  async setAdminPassword(password: string): Promise<void> {
    await this.ensureAuth()
    await set(ref(this.db, 'config/adminPassword'), password)
  }

  async setDefaultItems(type: CheckType, items: CheckItem[]): Promise<void> {
    await this.ensureAuth()
    await set(ref(this.db, `config/defaultItems/${type}`), items)
  }

  async listStores(): Promise<Store[]> {
    await this.ensureAuth()
    const snap = await get(ref(this.db, 'stores'))
    if (!snap.exists()) return []
    return Object.values(snap.val() as Record<string, Store>)
  }

  async saveStore(store: Store): Promise<void> {
    await this.ensureAuth()
    await set(ref(this.db, `stores/${store.id}`), store)
  }

  async deleteStore(storeId: string): Promise<void> {
    await this.ensureAuth()
    await remove(ref(this.db, `stores/${storeId}`))
  }

  private submissionRef(type: CheckType, periodKey: string, storeId: string) {
    return ref(this.db, `submissions/${type}/${periodKey}/${storeId}`)
  }

  private normalizeSubmission(raw: Submission): Submission {
    // RTDB は空オブジェクトを保存しないため items を補完
    return { ...raw, items: raw.items ?? {} }
  }

  async getSubmission(
    type: CheckType,
    periodKey: string,
    storeId: string,
  ): Promise<Submission | null> {
    await this.ensureAuth()
    const snap = await get(this.submissionRef(type, periodKey, storeId))
    return snap.exists() ? this.normalizeSubmission(snap.val() as Submission) : null
  }

  async listSubmissions(type: CheckType, periodKey: string): Promise<Record<string, Submission>> {
    await this.ensureAuth()
    const snap = await get(ref(this.db, `submissions/${type}/${periodKey}`))
    if (!snap.exists()) return {}
    const raw = snap.val() as Record<string, Submission>
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, this.normalizeSubmission(v)]),
    )
  }

  async uploadPhoto(params: {
    type: CheckType
    periodKey: string
    storeId: string
    itemId: string
    blob: Blob
    append: boolean
  }): Promise<PhotoRecord> {
    await this.ensureAuth()
    const { type, periodKey, storeId, itemId, blob, append } = params
    const photoId = newId()
    const path = `photos/${type}/${periodKey}/${storeId}/${itemId}/${photoId}.jpg`
    const sref = storageRef(this.storage, path)
    await uploadBytes(sref, blob, { contentType: 'image/jpeg' })
    const url = await getDownloadURL(sref)
    const photo: PhotoRecord = { id: photoId, url, uploadedAt: Date.now() }

    const subRef = this.submissionRef(type, periodKey, storeId)
    const snap = await get(subRef)
    const submission: Submission = snap.exists()
      ? this.normalizeSubmission(snap.val() as Submission)
      : { storeId, type, periodKey, items: {}, updatedAt: Date.now() }
    const photos = submission.items[itemId] ?? []
    submission.items[itemId] = append ? [...photos, photo] : [photo]
    submission.updatedAt = Date.now()
    await set(subRef, submission)
    // 差し替え時の古い写真は Storage 側も削除（失敗しても提出は成立させる）
    if (!append) {
      for (const old of photos) void this.deleteStorageByUrl(old.url)
    }
    return photo
  }

  private async deleteStorageByUrl(url: string): Promise<void> {
    try {
      await deleteObject(storageRef(this.storage, url))
    } catch {
      // 既に削除済み等は無視
    }
  }

  async deletePhoto(
    type: CheckType,
    periodKey: string,
    storeId: string,
    itemId: string,
    photoId: string,
  ): Promise<void> {
    await this.ensureAuth()
    const subRef = this.submissionRef(type, periodKey, storeId)
    const snap = await get(subRef)
    if (!snap.exists()) return
    const submission = this.normalizeSubmission(snap.val() as Submission)
    const photos = submission.items[itemId] ?? []
    const target = photos.find((p) => p.id === photoId)
    submission.items[itemId] = photos.filter((p) => p.id !== photoId)
    if (submission.items[itemId].length === 0) delete submission.items[itemId]
    submission.updatedAt = Date.now()
    await set(subRef, submission)
    if (target) void this.deleteStorageByUrl(target.url)
  }

  async moveSubmission(
    type: CheckType,
    fromKey: string,
    toKey: string,
    storeId: string,
  ): Promise<void> {
    await this.ensureAuth()
    const fromRef = this.submissionRef(type, fromKey, storeId)
    const snap = await get(fromRef)
    if (!snap.exists()) return
    const submission = this.normalizeSubmission(snap.val() as Submission)
    const toRef = this.submissionRef(type, toKey, storeId)
    const destSnap = await get(toRef)
    if (destSnap.exists()) {
      const dest = this.normalizeSubmission(destSnap.val() as Submission)
      for (const [itemId, photos] of Object.entries(submission.items)) {
        dest.items[itemId] = [...(dest.items[itemId] ?? []), ...photos]
      }
      dest.updatedAt = Date.now()
      await set(toRef, dest)
    } else {
      await set(toRef, { ...submission, periodKey: toKey, updatedAt: Date.now() })
    }
    await remove(fromRef)
  }

  async markReported(
    type: CheckType,
    periodKey: string,
    storeId: string,
    via: ReportedVia | null,
  ): Promise<void> {
    await this.ensureAuth()
    const subRef = this.submissionRef(type, periodKey, storeId)
    const snap = await get(subRef)
    if (via) {
      const submission: Submission = snap.exists()
        ? this.normalizeSubmission(snap.val() as Submission)
        : { storeId, type, periodKey, items: {}, updatedAt: Date.now() }
      submission.reportedVia = via
      submission.reportedAt = Date.now()
      submission.updatedAt = Date.now()
      await set(subRef, submission)
    } else if (snap.exists()) {
      const submission = this.normalizeSubmission(snap.val() as Submission)
      if (Object.keys(submission.items).length === 0) {
        await remove(subRef)
      } else {
        await update(subRef, { reportedVia: null, reportedAt: null, updatedAt: Date.now() })
      }
    }
  }

  async submitFeedback(fb: Omit<Feedback, 'id' | 'createdAt'>, screenshot?: Blob): Promise<void> {
    await this.ensureAuth()
    const id = newId()
    let screenshotUrl: string | undefined
    if (screenshot) {
      const sref = storageRef(this.storage, `feedback/${id}.jpg`)
      await uploadBytes(sref, screenshot, { contentType: 'image/jpeg' })
      screenshotUrl = await getDownloadURL(sref)
    }
    const record: Feedback = { ...fb, id, createdAt: Date.now() }
    if (screenshotUrl) record.screenshotUrl = screenshotUrl
    await set(ref(this.db, `feedback/${id}`), record)
  }

  async listFeedback(): Promise<Feedback[]> {
    await this.ensureAuth()
    const snap = await get(ref(this.db, 'feedback'))
    if (!snap.exists()) return []
    return (Object.values(snap.val() as Record<string, Feedback>) as Feedback[]).sort(
      (a, b) => b.createdAt - a.createdAt,
    )
  }

  async replyFeedback(feedbackId: string, message: string): Promise<void> {
    await this.ensureAuth()
    await set(ref(this.db, `feedback/${feedbackId}/reply`), {
      message,
      createdAt: Date.now(),
    })
  }

  async markFeedbackRead(feedbackId: string): Promise<void> {
    await this.ensureAuth()
    const replyRef = ref(this.db, `feedback/${feedbackId}/reply`)
    const snap = await get(replyRef)
    if (snap.exists() && !snap.val().readAt) {
      await update(replyRef, { readAt: Date.now() })
    }
  }

  async logError(log: Omit<ErrorLog, 'id' | 'createdAt'>): Promise<void> {
    await this.ensureAuth()
    const id = newId()
    await set(ref(this.db, `errorLogs/${id}`), { ...log, id, createdAt: Date.now() })
  }

  async listErrorLogs(): Promise<ErrorLog[]> {
    await this.ensureAuth()
    const snap = await get(ref(this.db, 'errorLogs'))
    if (!snap.exists()) return []
    return (Object.values(snap.val() as Record<string, ErrorLog>) as ErrorLog[]).sort(
      (a, b) => b.createdAt - a.createdAt,
    )
  }

  async cleanupOldData(retentionDays: number): Promise<number> {
    await this.ensureAuth()
    const cutoff = Date.now() - retentionDays * 86400_000
    let removed = 0
    for (const type of ['daily', 'weekly'] as CheckType[]) {
      const snap = await get(ref(this.db, `submissions/${type}`))
      if (!snap.exists()) continue
      const byPeriod = snap.val() as Record<string, Record<string, Submission>>
      for (const periodKey of Object.keys(byPeriod)) {
        const periodDate =
          type === 'daily' ? parseDateKey(periodKey) : mondayOfWeek(periodKey)
        if (periodDate.getTime() < cutoff) {
          for (const submission of Object.values(byPeriod[periodKey])) {
            for (const photos of Object.values(submission.items ?? {})) {
              for (const p of photos) void this.deleteStorageByUrl(p.url)
            }
          }
          removed += Object.keys(byPeriod[periodKey]).length
          await remove(ref(this.db, `submissions/${type}/${periodKey}`))
        }
      }
    }
    const logsSnap = await get(ref(this.db, 'errorLogs'))
    if (logsSnap.exists()) {
      const logs = logsSnap.val() as Record<string, ErrorLog>
      for (const [id, log] of Object.entries(logs)) {
        if (log.createdAt < cutoff) await remove(child(ref(this.db, 'errorLogs'), id))
      }
    }
    return removed
  }
}
