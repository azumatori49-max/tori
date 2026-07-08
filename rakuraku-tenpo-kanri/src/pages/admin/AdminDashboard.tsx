import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '@/AppContext'
import { BRAND } from '@/branding'
import { Header } from '@/components/Header'
import { PhotoImg } from '@/components/PhotoImg'
import { Badge, Button, Modal, Spinner, inputClass } from '@/components/ui'
import { resolveItems } from '@/lib/backend'
import { downloadCsv } from '@/lib/csv'
import {
  addDays,
  addWeeks,
  currentBusinessDate,
  currentBusinessWeek,
  formatDateKey,
  formatDateKeyLong,
  formatTime,
  formatWeekKey,
  recentBusinessDates,
  recentBusinessWeeks,
} from '@/lib/businessDay'
import type { CheckType, Store, Submission, SubmissionStatus } from '@/lib/types'

/**
 * 本部ダッシュボード（閲覧モードは readonly=true で同じ画面を共用）
 * - 提出済み / 一部提出 / 未提出 / LINE報告 を色分け集計
 * - 日付・週のさかのぼり、未提出のみ絞り込み、店舗名検索
 * - 店舗タップで写真ごとのアップロード時刻を確認（監査エビデンス）
 * - データ修正: 別の日付/週へ移動、写真削除、LINE報告済みマーク
 */
export function AdminDashboard({ readonly }: { readonly: boolean }) {
  const { backend, config, stores } = useApp()
  const [type, setType] = useState<CheckType>('daily')
  const [period, setPeriod] = useState(currentBusinessDate())
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({})
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [selected, setSelected] = useState<Store | null>(null)

  const activeStores = useMemo(
    () => stores.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [stores],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSubmissions(await backend.listSubmissions(type, period))
    } finally {
      setLoading(false)
    }
  }, [backend, type, period])

  useEffect(() => {
    void load()
  }, [load])

  const switchType = (t: CheckType) => {
    setType(t)
    setPeriod(t === 'daily' ? currentBusinessDate() : currentBusinessWeek())
  }

  const statusOf = useCallback(
    (store: Store): SubmissionStatus => {
      const submission = submissions[store.id]
      if (submission?.reportedVia && submission.reportedVia !== 'app') return 'reported'
      const items = resolveItems(config, store, type)
      const done = items.filter((i) => (submission?.items[i.id]?.length ?? 0) > 0).length
      if (done === 0) return 'none'
      return done >= items.length ? 'complete' : 'partial'
    },
    [submissions, config, type],
  )

  const counts = useMemo(() => {
    const c = { complete: 0, partial: 0, none: 0, reported: 0 }
    for (const s of activeStores) c[statusOf(s)]++
    return c
  }, [activeStores, statusOf])

  const visibleStores = useMemo(() => {
    let list = activeStores
    if (query.trim()) list = list.filter((s) => s.name.includes(query.trim()))
    if (onlyMissing) list = list.filter((s) => statusOf(s) === 'none' || statusOf(s) === 'partial')
    return list
  }, [activeStores, query, onlyMissing, statusOf])

  const exportCsv = () => {
    const rows: string[][] = [['店舗名', '状態', '提出項目数', '最終更新']]
    for (const s of activeStores) {
      const submission = submissions[s.id]
      const items = resolveItems(config, s, type)
      const done = items.filter((i) => (submission?.items[i.id]?.length ?? 0) > 0).length
      rows.push([
        s.name,
        statusLabel(statusOf(s)),
        `${done}/${items.length}`,
        submission ? formatTime(submission.updatedAt) : '',
      ])
    }
    downloadCsv(`提出状況_${type === 'daily' ? period : period}.csv`, rows)
  }

  const periodOptions =
    type === 'daily'
      ? recentBusinessDates(BRAND.dataRetentionDays > 60 ? 60 : BRAND.dataRetentionDays)
      : recentBusinessWeeks(12)

  return (
    <div className="min-h-dvh bg-slate-50 pb-10">
      <Header
        title={readonly ? '閲覧モード' : '本部ダッシュボード'}
        right={
          !readonly ? (
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/admin/stores" label="店舗管理" />
              <NavLink to="/admin/feedback" label="要望" />
              <NavLink to="/admin/errors" label="エラー" />
              <NavLink to="/admin/settings" label="設定" />
            </nav>
          ) : undefined
        }
      />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        {!readonly && (
          <nav className="flex gap-2 overflow-x-auto sm:hidden">
            <NavLink to="/admin/stores" label="店舗管理" />
            <NavLink to="/admin/feedback" label="要望" />
            <NavLink to="/admin/errors" label="エラーログ" />
            <NavLink to="/admin/settings" label="設定" />
          </nav>
        )}

        {/* 期間ナビゲーション */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['daily', 'weekly'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchType(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                  type === t ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                {t === 'daily' ? 'デイリー' : 'ウィークリー'}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setPeriod(type === 'daily' ? addDays(period, -1) : addWeeks(period, -1))}
              className="rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50"
              aria-label="前へ"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <select
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-2 py-2.5 text-center text-sm font-bold text-brand-800"
              value={periodOptions.includes(period) ? period : ''}
              onChange={(e) => e.target.value && setPeriod(e.target.value)}
            >
              {!periodOptions.includes(period) && <option value="">{period}</option>}
              {periodOptions.map((p) => (
                <option key={p} value={p}>
                  {type === 'daily' ? formatDateKeyLong(p) : formatWeekKey(p)}
                </option>
              ))}
            </select>
            <button
              onClick={() => setPeriod(type === 'daily' ? addDays(period, 1) : addWeeks(period, 1))}
              disabled={period === (type === 'daily' ? currentBusinessDate() : currentBusinessWeek())}
              className="rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50 disabled:opacity-30"
              aria-label="次へ"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>

          {/* 集計 */}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <StatCell label="提出済み" value={counts.complete} className="bg-emerald-50 text-emerald-700" />
            <StatCell label="一部提出" value={counts.partial} className="bg-amber-50 text-amber-700" />
            <StatCell label="未提出" value={counts.none} className="bg-red-50 text-red-700" />
            <StatCell label="LINE/口頭" value={counts.reported} className="bg-sky-50 text-sky-700" />
          </div>
        </section>

        {/* 検索・絞り込み・CSV */}
        <section className="flex flex-wrap items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="店舗名で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={() => setOnlyMissing(!onlyMissing)}
            className={`rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
              onlyMissing ? 'bg-red-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            未提出のみ
          </button>
          <Button variant="secondary" size="sm" onClick={exportCsv} className="py-2.5">
            CSV出力
          </Button>
        </section>

        {/* 店舗一覧 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="text-brand-600" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {visibleStores.map((store) => {
              const status = statusOf(store)
              const submission = submissions[store.id]
              const items = resolveItems(config, store, type)
              const done = items.filter((i) => (submission?.items[i.id]?.length ?? 0) > 0).length
              return (
                <button
                  key={store.id}
                  onClick={() => setSelected(store)}
                  className={`rounded-2xl border-l-4 bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-100 transition hover:shadow-md ${borderColor(status)}`}
                >
                  <div className="truncate font-bold text-slate-800">{store.name}</div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <StatusBadge status={status} />
                    <span className="text-xs font-semibold text-slate-400">{done}/{items.length}</span>
                  </div>
                </button>
              )
            })}
            {visibleStores.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate-400">
                該当する店舗がありません
              </p>
            )}
          </div>
        )}
      </main>

      {selected && (
        <StoreDetailModal
          store={selected}
          type={type}
          period={period}
          submission={submissions[selected.id] ?? null}
          readonly={readonly}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50"
    >
      {label}
    </Link>
  )
}

function StatCell({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-xl p-2 ${className}`}>
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[11px] font-bold">{label}</div>
    </div>
  )
}

function statusLabel(s: SubmissionStatus): string {
  return { complete: '提出済み', partial: '一部提出', none: '未提出', reported: 'LINE/口頭報告' }[s]
}

function borderColor(s: SubmissionStatus): string {
  return {
    complete: 'border-emerald-500',
    partial: 'border-amber-400',
    none: 'border-red-400',
    reported: 'border-sky-400',
  }[s]
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const color = { complete: 'green', partial: 'yellow', none: 'red', reported: 'blue' } as const
  return <Badge color={color[status]}>{statusLabel(status)}</Badge>
}

/** 店舗詳細モーダル: 写真＋アップロード時刻、データ修正、LINE報告マーク */
function StoreDetailModal({
  store,
  type,
  period,
  submission,
  readonly,
  onClose,
  onChanged,
}: {
  store: Store
  type: CheckType
  period: string
  submission: Submission | null
  readonly: boolean
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const { backend, config } = useApp()
  const items = resolveItems(config, store, type)
  const [busy, setBusy] = useState(false)
  const [moveTarget, setMoveTarget] = useState('')
  const [zoom, setZoom] = useState<string | null>(null)
  const isReported = submission?.reportedVia && submission.reportedVia !== 'app'

  const moveOptions = (type === 'daily' ? recentBusinessDates(30) : recentBusinessWeeks(12)).filter(
    (p) => p !== period,
  )

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={store.name} wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-brand-800">
          {type === 'daily' ? formatDateKeyLong(period) : formatWeekKey(period)}
        </p>
        {isReported && (
          <Badge color="blue">
            {submission!.reportedVia === 'line' ? 'LINE報告済み' : '口頭報告済み'}
            {submission!.reportedAt ? `（${formatTime(submission!.reportedAt)}）` : ''}
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const photos = submission?.items[item.id] ?? []
          return (
            <div key={item.id} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">{item.name}</span>
                {photos.length > 0 ? (
                  <Badge color="green">{photos.length}枚</Badge>
                ) : (
                  <Badge color="red">未提出</Badge>
                )}
              </div>
              {photos.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {photos.map((p) => (
                    <div key={p.id} className="relative">
                      <PhotoImg
                        url={p.url}
                        alt={`${store.name} ${item.name}`}
                        className="aspect-square w-full cursor-zoom-in rounded-lg object-cover"
                        onClick={() => setZoom(p.url)}
                      />
                      {/* 写真ごとのアップロード時刻（実施時間の監査エビデンス） */}
                      <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1 py-0.5 text-[10px] font-semibold text-white">
                        {formatTime(p.uploadedAt)}
                      </span>
                      {!readonly && (
                        <button
                          aria-label="写真を削除"
                          disabled={busy}
                          onClick={() =>
                            confirm('この写真を削除しますか？（元に戻せません）') &&
                            act(() => backend.deletePhoto(type, period, store.id, item.id, p.id))
                          }
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!readonly && (
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
          <div>
            <h3 className="mb-2 text-sm font-bold text-slate-700">アプリ外報告の記録</h3>
            <div className="flex flex-wrap gap-2">
              {!isReported ? (
                <>
                  <Button size="sm" variant="secondary" disabled={busy}
                    onClick={() => act(() => backend.markReported(type, period, store.id, 'line'))}>
                    提出済み（LINE）にする
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy}
                    onClick={() => act(() => backend.markReported(type, period, store.id, 'verbal'))}>
                    提出済み（口頭）にする
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" disabled={busy}
                  onClick={() => act(() => backend.markReported(type, period, store.id, null))}>
                  報告済みマークを解除
                </Button>
              )}
            </div>
          </div>

          {submission && Object.keys(submission.items).length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-700">
                提出を別の{type === 'daily' ? '日付' : '週'}へ移動（データ修正）
              </h3>
              <div className="flex gap-2">
                <select className={inputClass} value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                  <option value="">— 移動先を選択 —</option>
                  {moveOptions.map((p) => (
                    <option key={p} value={p}>
                      {type === 'daily' ? formatDateKeyLong(p) : formatWeekKey(p)}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!moveTarget || busy}
                  onClick={() =>
                    confirm(`この提出を${type === 'daily' ? formatDateKey(moveTarget) : formatWeekKey(moveTarget)}へ移動しますか？`) &&
                    act(async () => {
                      await backend.moveSubmission(type, period, moveTarget, store.id)
                      setMoveTarget('')
                    })
                  }>
                  移動
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(null)}>
          <PhotoImg url={zoom} alt="拡大表示" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </Modal>
  )
}
