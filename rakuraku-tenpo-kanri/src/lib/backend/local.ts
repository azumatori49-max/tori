import { idbDelete, idbPut } from '../idb'
import { parseDateKey, mondayOfWeek } from '../businessDay'
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
import { DEFAULT_CONFIG, DEMO_STORES } from './seed'

/**
 * デモモードのバックエンド実装。
 * メタデータは localStorage、写真は IndexedDB に保存する。
 * Firebase の環境変数を設定すると自動的に本番バックエンドに切り替わる。
 */
const LS_PREFIX = 'rakuraku.data.'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
}

type SubmissionMap = Record<string, Record<string, Submission>> // periodKey -> storeId -> Submission

export class LocalBackend implements Backend {
  readonly isDemo = true

  constructor() {
    // 初回起動時にデモ店舗を投入
    if (!localStorage.getItem(LS_PREFIX + 'initialized')) {
      write('config', DEFAULT_CONFIG)
      write(
        'stores',
        DEMO_STORES.map((s) => ({ ...s, createdAt: Date.now() })),
      )
      localStorage.setItem(LS_PREFIX + 'initialized', '1')
    }
  }

  async getConfig(): Promise<AppConfig> {
    return read<AppConfig>('config', DEFAULT_CONFIG)
  }

  async setAdminPassword(password: string): Promise<void> {
    const config = await this.getConfig()
    write('config', { ...config, adminPassword: password })
  }

  async setDefaultItems(type: CheckType, items: CheckItem[]): Promise<void> {
    const config = await this.getConfig()
    write('config', {
      ...config,
      defaultItems: { ...config.defaultItems, [type]: items },
    })
  }

  async listStores(): Promise<Store[]> {
    return read<Store[]>('stores', [])
  }

  async saveStore(store: Store): Promise<void> {
    const stores = await this.listStores()
    const idx = stores.findIndex((s) => s.id === store.id)
    if (idx >= 0) stores[idx] = store
    else stores.push(store)
    write('stores', stores)
  }

  async deleteStore(storeId: string): Promise<void> {
    write(
      'stores',
      (await this.listStores()).filter((s) => s.id !== storeId),
    )
  }

  private submissions(type: CheckType): SubmissionMap {
    return read<SubmissionMap>(`submissions.${type}`, {})
  }

  private writeSubmissions(type: CheckType, map: SubmissionMap): void {
    write(`submissions.${type}`, map)
  }

  async getSubmission(
    type: CheckType,
    periodKey: string,
    storeId: string,
  ): Promise<Submission | null> {
    return this.submissions(type)[periodKey]?.[storeId] ?? null
  }

  async listSubmissions(type: CheckType, periodKey: string): Promise<Record<string, Submission>> {
    return this.submissions(type)[periodKey] ?? {}
  }

  async uploadPhoto(params: {
    type: CheckType
    periodKey: string
    storeId: string
    itemId: string
    blob: Blob
    append: boolean
  }): Promise<PhotoRecord> {
    const { type, periodKey, storeId, itemId, blob, append } = params
    const photoId = newId()
    await idbPut(photoId, blob)
    const photo: PhotoRecord = { id: photoId, url: `idb:${photoId}`, uploadedAt: Date.now() }

    const map = this.submissions(type)
    const byStore = (map[periodKey] ??= {})
    const submission = (byStore[storeId] ??= {
      storeId,
      type,
      periodKey,
      items: {},
      updatedAt: Date.now(),
    })
    const photos = submission.items[itemId] ?? []
    if (append) {
      submission.items[itemId] = [...photos, photo]
    } else {
      // 差し替え: 古い写真の実体も削除
      for (const old of photos) void idbDelete(old.id)
      submission.items[itemId] = [photo]
    }
    submission.updatedAt = Date.now()
    this.writeSubmissions(type, map)
    return photo
  }

  async deletePhoto(
    type: CheckType,
    periodKey: string,
    storeId: string,
    itemId: string,
    photoId: string,
  ): Promise<void> {
    const map = this.submissions(type)
    const submission = map[periodKey]?.[storeId]
    if (!submission) return
    submission.items[itemId] = (submission.items[itemId] ?? []).filter((p) => p.id !== photoId)
    if (submission.items[itemId].length === 0) delete submission.items[itemId]
    submission.updatedAt = Date.now()
    this.writeSubmissions(type, map)
    await idbDelete(photoId)
  }

  async moveSubmission(
    type: CheckType,
    fromKey: string,
    toKey: string,
    storeId: string,
  ): Promise<void> {
    const map = this.submissions(type)
    const submission = map[fromKey]?.[storeId]
    if (!submission) return
    delete map[fromKey][storeId]
    const dest = (map[toKey] ??= {})
    const existing = dest[storeId]
    if (existing) {
      // 移動先に既存データがある場合は写真をマージ
      for (const [itemId, photos] of Object.entries(submission.items)) {
        existing.items[itemId] = [...(existing.items[itemId] ?? []), ...photos]
      }
      existing.updatedAt = Date.now()
    } else {
      dest[storeId] = { ...submission, periodKey: toKey, updatedAt: Date.now() }
    }
    this.writeSubmissions(type, map)
  }

  async markReported(
    type: CheckType,
    periodKey: string,
    storeId: string,
    via: ReportedVia | null,
  ): Promise<void> {
    const map = this.submissions(type)
    const byStore = (map[periodKey] ??= {})
    const submission = (byStore[storeId] ??= {
      storeId,
      type,
      periodKey,
      items: {},
      updatedAt: Date.now(),
    })
    if (via) {
      submission.reportedVia = via
      submission.reportedAt = Date.now()
    } else {
      delete submission.reportedVia
      delete submission.reportedAt
      // 写真もない空データなら消しておく
      if (Object.keys(submission.items).length === 0) delete byStore[storeId]
    }
    this.writeSubmissions(type, map)
  }

  async submitFeedback(fb: Omit<Feedback, 'id' | 'createdAt'>, screenshot?: Blob): Promise<void> {
    const id = newId()
    let screenshotUrl: string | undefined
    if (screenshot) {
      const key = `fb-${id}`
      await idbPut(key, screenshot)
      screenshotUrl = `idb:${key}`
    }
    const list = read<Feedback[]>('feedback', [])
    list.unshift({ ...fb, id, createdAt: Date.now(), screenshotUrl })
    write('feedback', list)
  }

  async listFeedback(): Promise<Feedback[]> {
    return read<Feedback[]>('feedback', [])
  }

  async replyFeedback(feedbackId: string, message: string): Promise<void> {
    const list = read<Feedback[]>('feedback', [])
    const fb = list.find((f) => f.id === feedbackId)
    if (fb) {
      fb.reply = { message, createdAt: Date.now() }
      write('feedback', list)
    }
  }

  async markFeedbackRead(feedbackId: string): Promise<void> {
    const list = read<Feedback[]>('feedback', [])
    const fb = list.find((f) => f.id === feedbackId)
    if (fb?.reply && !fb.reply.readAt) {
      fb.reply.readAt = Date.now()
      write('feedback', list)
    }
  }

  async logError(log: Omit<ErrorLog, 'id' | 'createdAt'>): Promise<void> {
    const list = read<ErrorLog[]>('errorLogs', [])
    list.unshift({ ...log, id: newId(), createdAt: Date.now() })
    write('errorLogs', list.slice(0, 500))
  }

  async listErrorLogs(): Promise<ErrorLog[]> {
    return read<ErrorLog[]>('errorLogs', [])
  }

  async cleanupOldData(retentionDays: number): Promise<number> {
    const cutoff = Date.now() - retentionDays * 86400_000
    let removed = 0
    for (const type of ['daily', 'weekly'] as CheckType[]) {
      const map = this.submissions(type)
      for (const periodKey of Object.keys(map)) {
        const periodDate =
          type === 'daily' ? parseDateKey(periodKey) : mondayOfWeek(periodKey)
        if (periodDate.getTime() < cutoff) {
          for (const submission of Object.values(map[periodKey])) {
            for (const photos of Object.values(submission.items)) {
              for (const p of photos) void idbDelete(p.id)
            }
          }
          removed += Object.keys(map[periodKey]).length
          delete map[periodKey]
        }
      }
      this.writeSubmissions(type, map)
    }
    const logs = read<ErrorLog[]>('errorLogs', [])
    write(
      'errorLogs',
      logs.filter((l) => l.createdAt >= cutoff),
    )
    return removed
  }
}
