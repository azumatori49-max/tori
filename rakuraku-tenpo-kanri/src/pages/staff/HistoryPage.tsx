import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/AppContext'
import { BRAND } from '@/branding'
import { Header } from '@/components/Header'
import { Badge, Spinner } from '@/components/ui'
import { resolveItems } from '@/lib/backend'
import {
  formatDateKey,
  formatWeekKey,
  recentBusinessDates,
  recentBusinessWeeks,
} from '@/lib/businessDay'
import type { CheckType, Submission } from '@/lib/types'

/** 過去の提出履歴（デイリー14日 / ウィークリー8週さかのぼり） */
export function HistoryPage() {
  const { backend, session, config, stores } = useApp()
  const navigate = useNavigate()
  const store = stores.find((s) => s.id === session?.storeId)
  const [tab, setTab] = useState<CheckType>('daily')
  const [rows, setRows] = useState<{ period: string; submission: Submission | null }[]>([])
  const [loading, setLoading] = useState(true)

  const periods = useMemo(
    () =>
      tab === 'daily'
        ? recentBusinessDates(BRAND.dailyHistoryDays)
        : recentBusinessWeeks(BRAND.weeklyHistoryWeeks),
    [tab],
  )

  useEffect(() => {
    if (!session?.storeId) return
    setLoading(true)
    void Promise.all(
      periods.map(async (period) => ({
        period,
        submission: await backend.getSubmission(tab, period, session.storeId!),
      })),
    )
      .then(setRows)
      .finally(() => setLoading(false))
  }, [backend, periods, session?.storeId, tab])

  const items = resolveItems(config, store, tab)

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header title="提出履歴" backTo="/staff" />
      <main className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
          {(['daily', 'weekly'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                tab === t ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t === 'daily' ? `デイリー（${BRAND.dailyHistoryDays}日分）` : `ウィークリー（${BRAND.weeklyHistoryWeeks}週分）`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="text-brand-600" />
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(({ period, submission }) => {
              const done = items.filter((i) => (submission?.items[i.id]?.length ?? 0) > 0).length
              const total = items.length
              return (
                <button
                  key={period}
                  onClick={() => navigate(`/staff/check/${tab}?period=${period}`)}
                  className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-100 hover:ring-brand-200"
                >
                  <span className="font-bold text-slate-700">
                    {tab === 'daily' ? formatDateKey(period) : formatWeekKey(period)}
                  </span>
                  {submission?.reportedVia && submission.reportedVia !== 'app' ? (
                    <Badge color="blue">{submission.reportedVia === 'line' ? 'LINE報告' : '口頭報告'}</Badge>
                  ) : done >= total && total > 0 ? (
                    <Badge color="green">提出完了</Badge>
                  ) : done > 0 ? (
                    <Badge color="yellow">{done} / {total}</Badge>
                  ) : (
                    <Badge color="red">未提出</Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}
        <p className="mt-4 text-center text-xs text-slate-400">
          タップするとその日の提出内容を確認・追加提出できます
        </p>
      </main>
    </div>
  )
}
