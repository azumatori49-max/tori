import { useEffect, useState } from 'react'
import { useApp } from '@/AppContext'
import { Header } from '@/components/Header'
import { AdminNav } from '@/components/AdminNav'
import { Spinner } from '@/components/ui'
import { formatTime } from '@/lib/businessDay'
import type { ErrorLog } from '@/lib/types'

/**
 * 自動エラーログ
 * アップロード失敗時に店舗名・時刻・何をしていて失敗したかが自動記録される。
 * 「送れなかった」店舗と「送らなかった」店舗を区別でき、評価の公平性を担保。
 */
export function ErrorLogsPage() {
  const { backend } = useApp()
  const [logs, setLogs] = useState<ErrorLog[] | null>(null)

  useEffect(() => {
    void backend.listErrorLogs().then(setLogs)
  }, [backend])

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <Header title="自動エラーログ" backTo="/admin/settings" />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <p className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-xs text-sky-800 ring-1 ring-sky-100">
          アップロードに失敗すると、店舗名・時刻・失敗した操作が自動でここに記録されます。
          「送れなかった」店舗と「送らなかった」店舗を区別するための機能です。
        </p>
        {!logs ? (
          <div className="flex justify-center py-10"><Spinner className="text-brand-600" /></div>
        ) : logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">エラーは記録されていません 🎉</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{log.storeName}</span>
                  <span className="text-xs text-slate-400">{formatTime(log.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-red-700">{log.context}</p>
                <p className="mt-0.5 break-all text-xs text-slate-400">{log.message}</p>
              </div>
            ))}
          </div>
        )}
      </main>
      <AdminNav />
    </div>
  )
}
