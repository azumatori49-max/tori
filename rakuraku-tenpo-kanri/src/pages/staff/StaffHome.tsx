import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '@/AppContext'
import { BRAND } from '@/branding'
import { Header } from '@/components/Header'
import { Badge } from '@/components/ui'
import { resolveItems } from '@/lib/backend'
import {
  currentBusinessDate,
  currentBusinessWeek,
  formatDateKeyLong,
  formatWeekKey,
  recentBusinessDates,
  recentBusinessWeeks,
  weekKeyOfDate,
} from '@/lib/businessDay'
import type { CheckType, Submission } from '@/lib/types'

/**
 * 店舗スタッフのホーム画面
 * 業務日（朝9時切り替え）を明示し、手動変更も可能。
 * デイリー / ウィークリーの進捗を表示。
 */
export function StaffHome() {
  const { backend, session, config, stores } = useApp()
  const navigate = useNavigate()
  const store = stores.find((s) => s.id === session?.storeId)

  const [date, setDate] = useState(currentBusinessDate())
  const week = weekKeyOfDate(date)
  const [daily, setDaily] = useState<Submission | null>(null)
  const [weekly, setWeekly] = useState<Submission | null>(null)

  useEffect(() => {
    if (!session?.storeId) return
    void backend.getSubmission('daily', date, session.storeId).then(setDaily)
    void backend.getSubmission('weekly', week, session.storeId).then(setWeekly)
  }, [backend, session?.storeId, date, week])

  const progress = useMemo(() => {
    const calc = (type: CheckType, submission: Submission | null) => {
      const items = resolveItems(config, store, type)
      const done = items.filter((i) => (submission?.items[i.id]?.length ?? 0) > 0).length
      return { done, total: items.length }
    }
    return { daily: calc('daily', daily), weekly: calc('weekly', weekly) }
  }, [config, store, daily, weekly])

  const isToday = date === currentBusinessDate()
  const isThisWeek = week === currentBusinessWeek()

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header title={store?.name} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {/* 提出日の明示表示＋手動変更 */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">本日の提出日（業務日）</p>
              <p className="text-lg font-bold text-brand-800">{formatDateKeyLong(date)}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                朝{BRAND.businessDayCutoverHour}時までの報告は前日分として扱われます
              </p>
            </div>
            <select
              className="rounded-xl border border-slate-300 px-2 py-2 text-sm font-semibold"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="提出日を変更"
            >
              {recentBusinessDates(BRAND.dailyHistoryDays).map((d) => (
                <option key={d} value={d}>
                  {formatDateKeyLong(d)}{d === currentBusinessDate() ? '（今日）' : ''}
                </option>
              ))}
            </select>
          </div>
          {!isToday && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              過去の日付（{formatDateKeyLong(date)}）分として提出します
            </p>
          )}
        </section>

        {/* デイリーチェック */}
        <CheckCard
          title="デイリーチェック"
          subtitle={formatDateKeyLong(date)}
          done={progress.daily.done}
          total={progress.daily.total}
          onClick={() => navigate(`/staff/check/daily?period=${date}`)}
        />

        {/* ウィークリーチェック */}
        <CheckCard
          title="ウィークリーチェック"
          subtitle={`${formatWeekKey(week)}${isThisWeek ? '（今週）' : ''}`}
          done={progress.weekly.done}
          total={progress.weekly.total}
          onClick={() => navigate(`/staff/check/weekly?period=${week}`)}
        />

        <Link
          to="/staff/history"
          className="block rounded-2xl bg-white p-4 text-center font-bold text-brand-700 shadow-sm ring-1 ring-slate-100 hover:bg-brand-50"
        >
          過去の提出履歴を見る（デイリー{BRAND.dailyHistoryDays}日 / ウィークリー{BRAND.weeklyHistoryWeeks}週）
        </Link>

        {recentBusinessWeeks(1)[0] !== week && null}
      </main>
    </div>
  )
}

function CheckCard({
  title,
  subtitle,
  done,
  total,
  onClick,
}: {
  title: string
  subtitle: string
  done: number
  total: number
  onClick: () => void
}) {
  const complete = total > 0 && done >= total
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-100 transition hover:ring-brand-200 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {complete ? (
          <Badge color="green">提出完了</Badge>
        ) : done > 0 ? (
          <Badge color="yellow">あと{total - done}項目</Badge>
        ) : (
          <Badge color="red">未提出</Badge>
        )}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>{done} / {total} 項目</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-500' : 'bg-brand-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  )
}
