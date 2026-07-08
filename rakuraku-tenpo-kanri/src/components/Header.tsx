import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/AppContext'
import { LogoMark } from './Logo'
import { FeedbackWidget } from './FeedbackWidget'

/** 全画面共通ヘッダー: 左上にフィードバックボタン、中央にロゴ、右にログアウト等 */
export function Header({
  title,
  subtitle,
  backTo,
  right,
}: {
  title?: string
  subtitle?: string
  backTo?: string
  right?: ReactNode
}) {
  const navigate = useNavigate()
  const { session, logout, backend } = useApp()

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/90 backdrop-blur">
      {backend.isDemo && (
        <div className="bg-amber-400/90 px-3 py-1 text-center text-xs font-bold text-amber-950">
          デモモード（データはこの端末にのみ保存されます）
        </div>
      )}
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5">
        <FeedbackWidget />
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            aria-label="戻る"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <LogoMark size={subtitle ? 30 : 26} />
          <div className="min-w-0 text-center">
            <div className="truncate text-sm font-bold text-brand-800">
              {title ?? 'らくらく店舗カンリ'}
            </div>
            {subtitle && <div className="truncate text-xs text-slate-400">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {right}
          {session && (
            <button
              onClick={() => {
                if (confirm('ログアウトしますか？')) logout()
              }}
              className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              ログアウト
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
