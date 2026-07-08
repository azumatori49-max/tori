import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getBackend, type Backend } from '@/lib/backend'
import { clearSession, loadSession, saveSession, touchSession } from '@/lib/session'
import type { AppConfig, Role, SessionData, Store } from '@/lib/types'
import { Spinner } from '@/components/ui'
import { LogoMark } from '@/components/Logo'

interface AppContextValue {
  backend: Backend
  session: SessionData | null
  config: AppConfig
  stores: Store[]
  login: (role: Role, storeId?: string, storeName?: string) => void
  logout: () => void
  refreshStores: () => Promise<void>
  refreshConfig: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null)
  const [session, setSession] = useState<SessionData | null>(() => loadSession())
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [stores, setStores] = useState<Store[]>([])

  useEffect(() => {
    let mounted = true
    getBackend().then(async (b) => {
      const [cfg, storeList] = await Promise.all([b.getConfig(), b.listStores()])
      if (mounted) {
        setBackend(b)
        setConfig(cfg)
        setStores(storeList)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  // 操作のたびにセッションの最終利用時刻を更新（自動ログアウト判定用）
  useEffect(() => {
    const handler = () => touchSession()
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  const login = useCallback((role: Role, storeId?: string, storeName?: string) => {
    const s: SessionData = { role, storeId, storeName, lastActiveAt: Date.now() }
    saveSession(s)
    setSession(s)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const refreshStores = useCallback(async () => {
    if (backend) setStores(await backend.listStores())
  }, [backend])

  const refreshConfig = useCallback(async () => {
    if (backend) setConfig(await backend.getConfig())
  }, [backend])

  const value = useMemo(
    () =>
      backend && config
        ? { backend, session, config, stores, login, logout, refreshStores, refreshConfig }
        : null,
    [backend, session, config, stores, login, logout, refreshStores, refreshConfig],
  )

  if (!value) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-50">
        <LogoMark size={72} />
        <Spinner className="text-brand-600" />
      </div>
    )
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
