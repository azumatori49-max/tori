import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/AppContext'
import { Header } from '@/components/Header'
import { AdminNav } from '@/components/AdminNav'
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
import type { CheckItem, CheckType, PhotoRecord, Store, Submission, SubmissionStatus } from '@/lib/types'

/**
 * 本部ダッシュボード（閲覧モードは readonly=true で同じ画面を共用）
 * 店舗カードに写真サムネイルを直接表示し、その場でLINE報告の記録もできる。
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
  const [busyStoreId, setBusyStoreId] = useState('')

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
    const c = { complete: 0, partial: 0, none: 0 }
    for (const s of activeStores) {
      const st = statusOf(s)
      if (st === 'complete' || st === 'reported') c.complete++
      else if (st === 'partial') c.partial++
      else c.none++
    }
    return c
  }, [activeStores, statusOf])

  const visibleStores = useMemo(() => {
    let list = activeStores
    if (query.trim()) list = list.filter((s) => s.name.includes(query.trim()))
    if (onlyMissing)
      list = list.filter((s) => {
        const st = statusOf(s)
        return st === 'none' || st === 'partial'
      })
    return list
  }, [activeStores, query, onlyMissing, statusOf])

  const markLine = async (store: Store) => {
    if (!confirm(`「${store.name}」をLINE報告として提出済みにしますか？`)) return
    setBusyStoreId(store.id)
    try {
      await backend.markReported(type, period, store.id, 'line')
      await load()
    } finally {
      setBusyStoreId('')
    }
  }

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
    downloadCsv(`提出状況_${period}.csv`, rows)
  }

  const periodOptions = type === 'daily' ? recentBusinessDates(60) : recentBusinessWeeks(12)

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <Header
        title={readonly ? '閲覧モード' : '管理者ダッシュボード'}
        subtitle={formatDateKeyLong(currentBusinessDate())}
      />
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        {/* デイリー / ウィークリー切り替え */}
        <div className="flex rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-100">
          {(['daily', 'weekly'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchType(t)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                type === t ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {t === 'daily' ? 'デイリー' : 'ウィークリー'}
            </button>
          ))}
        </div>

        {/* 日付・週ナビゲーション */}
        <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-100">
          <button
            onClick={() => setPeriod(type === 'daily' ? addDays(period, -1) : addWeeks(period, -1))}
            className="rounded-xl bg-slate-100 p-3 hover:bg-slate-200"
            aria-label="前へ"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
          </button>
          <select
            className="min-w-0 flex-1 appearance-none bg-transparent text-center text-base font-bold text-slate-800 focus:outline-none"
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
            className="rounded-xl bg-slate-100 p-3 hover:bg-slate-200 disabled:opacity-30"
            aria-label="次へ"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
          </button>
        </div>

        {/* 集計（LINE報告は提出済みに含める） */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatCell label="提出済み" value={counts.complete} className="bg-emerald-50 text-emerald-700" />
          <StatCell label="一部提出" value={counts.partial} className="bg-amber-50 text-amber-700" />
          <StatCell label="未提出" value={counts.none} className="bg-red-50 text-red-600" />
        </div>

        {/* 検索 */}
        <input
          className={`${inputClass} bg-white`}
          placeholder="店舗名で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* 絞り込み・更新・CSV */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOnlyMissing(!onlyMissing)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              onlyMissing
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200'
            }`}
          >
            {onlyMissing ? '✓ ' : ''}未提出のみ
          </button>
          <div className="flex items-center gap-3">
            <button onClick={exportCsv} className="text-sm font-semibold text-slate-500 hover:text-brand-700">
              CSV出力
            </button>
            <button
              onClick={() => void load()}
              className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5" /></svg>
              更新
            </button>
          </div>
        </div>

        {/* 店舗カード一覧 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="text-brand-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {visibleStores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                items={resolveItems(config, store, type)}
                submission={submissions[store.id] ?? null}
                status={statusOf(store)}
                readonly={readonly}
                busy={busyStoreId === store.id}
                onOpen={() => setSelected(store)}
                onMarkLine={() => markLine(store)}
              />
            ))}
            {visibleStores.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">該当する店舗がありません</p>
            )}
          </div>
        )}
      </main>

      {!readonly && <AdminNav />}

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

function StatCell({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-2xl py-3.5 ${className}`}>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs font-bold">{label}</div>
    </div>
  )
}

function statusLabel(s: SubmissionStatus): string {
  return { complete: '提出済み', partial: '一部提出', none: '未提出', reported: 'LINE報告済み' }[s]
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const color = { complete: 'green', partial: 'yellow', none: 'red', reported: 'blue' } as const
  return <Badge color={color[status]}>{statusLabel(status)}</Badge>
}

/** 店舗カード: 写真サムネイルを直接表示し、LINE報告もその場で記録 */
function StoreCard({
  store,
  items,
  submission,
  status,
  readonly,
  busy,
  onOpen,
  onMarkLine,
}: {
  store: Store
  items: CheckItem[]
  submission: Submission | null
  status: SubmissionStatus
  readonly: boolean
  busy: boolean
  onOpen: () => void
  onMarkLine: () => void
}) {
  const allPhotos = items.flatMap((i) => submission?.items[i.id] ?? [])
  const latest = allPhotos.length
    ? Math.max(...allPhotos.map((p) => p.uploadedAt))
    : submission?.reportedAt

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-base font-bold text-slate-800">{store.name}</span>
          <StatusBadge status={status} />
        </div>

        {/* 項目ごとのサムネイル（未提出枠は点線プレースホルダー） */}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {items.map((item) => {
            const photos = submission?.items[item.id] ?? []
            return photos.length > 0 ? (
              <div key={item.id} className="relative shrink-0">
                <PhotoImg
                  url={photos[0].url}
                  alt={item.name}
                  className="h-14 w-14 rounded-lg object-cover"
                />
                {photos.length > 1 && (
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-slate-900/70 px-1 text-[10px] font-bold text-white">
                    +{photos.length - 1}
                  </span>
                )}
              </div>
            ) : (
              <div
                key={item.id}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300"
              >
                —
              </div>
            )
          })}
        </div>

        <p className="mt-2 text-xs text-slate-400">
          {status === 'reported' ? (
            <>LINE報告として記録済み{latest ? `: ${formatTime(latest)}` : ''}</>
          ) : allPhotos.length > 0 ? (
            <>提出: {formatTime(latest!)} ・ {allPhotos.length}枚</>
          ) : (
            <span className="font-semibold text-red-400">未提出</span>
          )}
        </p>
      </button>

      {/* インラインLINE報告ボタン */}
      {!readonly && (status === 'none' || status === 'partial') && (
        <button
          onClick={onMarkLine}
          disabled={busy}
          className="mt-3 w-full rounded-xl border border-brand-400 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50 disabled:opacity-40"
        >
          {busy
            ? '記録中…'
            : status === 'partial'
              ? '残りをLINE報告として完了にする'
              : 'LINE報告として提出済みにする'}
        </button>
      )}
    </div>
  )
}

/** 店舗詳細: 番号＋項目名付きの大きな撮影枠で表示（監査ビュー） */
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
  const totalPhotos = items.reduce((n, i) => n + (submission?.items[i.id]?.length ?? 0), 0)

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

  // 表示用スロット: 項目ごとに写真（multi は全枚数分）または空枠
  const slots: { key: string; label: string; item: CheckItem; photo: PhotoRecord | null }[] = []
  items.forEach((item, idx) => {
    const photos = submission?.items[item.id] ?? []
    if (photos.length === 0) {
      slots.push({ key: item.id, label: `${idx + 1}. ${item.name}`, item, photo: null })
    } else {
      photos.forEach((p, i) => {
        slots.push({
          key: p.id,
          label: photos.length > 1 ? `${idx + 1}. ${item.name}（${i + 1}/${photos.length}）` : `${idx + 1}. ${item.name}`,
          item,
          photo: p,
        })
      })
    }
  })

  return (
    <Modal open onClose={onClose} title={store.name} wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge color="blue">{type === 'daily' ? 'DAILY' : 'WEEKLY'}</Badge>
          <span className="text-sm font-bold text-brand-800">
            {type === 'daily' ? formatDateKeyLong(period) : formatWeekKey(period)}
          </span>
        </div>
        <span className="text-sm font-semibold text-slate-500">
          {totalPhotos}枚 / 目標 {items.length}
        </span>
      </div>
      {isReported && (
        <p className="mb-3">
          <Badge color="blue">
            {submission!.reportedVia === 'line' ? 'LINE報告済み' : '口頭報告済み'}
            {submission!.reportedAt ? `（${formatTime(submission!.reportedAt)}）` : ''}
          </Badge>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {slots.map((slot) => (
          <div key={slot.key}>
            {slot.photo ? (
              <div className="relative">
                <PhotoImg
                  url={slot.photo.url}
                  alt={slot.label}
                  className="aspect-square w-full cursor-zoom-in rounded-xl object-cover"
                  onClick={() => setZoom(slot.photo!.url)}
                />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {formatTime(slot.photo.uploadedAt)}
                </span>
                {!readonly && (
                  <button
                    aria-label="写真を削除"
                    disabled={busy}
                    onClick={() =>
                      confirm('この写真を削除しますか？（元に戻せません）') &&
                      act(() =>
                        backend.deletePhoto(type, period, store.id, slot.item.id, slot.photo!.id),
                      )
                    }
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-300">
                未提出
              </div>
            )}
            <p className="mt-1 truncate text-center text-xs font-semibold text-slate-600">
              {slot.label}
            </p>
          </div>
        ))}
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
