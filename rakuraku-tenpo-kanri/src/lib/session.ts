import { BRAND } from '@/branding'
import type { SessionData } from './types'

/**
 * ログインセッション管理
 * 一度ログインすれば端末に保存され、一定期間未使用で自動ログアウト。
 */
const KEY = 'rakuraku.session'

export function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as SessionData
    const expiry = BRAND.autoLogoutDays * 86400_000
    if (Date.now() - session.lastActiveAt > expiry) {
      localStorage.removeItem(KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveSession(session: SessionData): void {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function touchSession(): void {
  const s = loadSession()
  if (s) saveSession({ ...s, lastActiveAt: Date.now() })
}

export function clearSession(): void {
  localStorage.removeItem(KEY)
}
