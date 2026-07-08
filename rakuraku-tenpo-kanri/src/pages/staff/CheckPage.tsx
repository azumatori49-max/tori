import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '@/AppContext'
import { BRAND } from '@/branding'
import { Header } from '@/components/Header'
import { PhotoImg } from '@/components/PhotoImg'
import { Badge, Spinner } from '@/components/ui'
import { resolveItems } from '@/lib/backend'
import { formatDateKeyLong, formatTime, formatWeekKey } from '@/lib/businessDay'
import { compressImage } from '@/lib/image'
import { withRetry } from '@/lib/retry'
import type { CheckItem, CheckType, Submission } from '@/lib/types'

/**
 * チェック提出画面
 * - 各撮影枠に項目名を表示（撮り忘れ防止）
 * - カメラ直撮り限定（不正防止のため写真フォルダから選択不可）
 * - 防犯カメラ等の multi 項目のみ複数枚・フォルダ選択可
 * - 1枚ごとに途中保存: 失敗しても成功した分は保存済み
 * - 提出後の撮り直し・差し替え可
 * - 失敗時は自動リトライ（最大3回）＋本部へ自動エラーログ
 */
export function CheckPage() {
  const { type } = useParams<{ type: CheckType }>()
  const [params] = useSearchParams()
  const period = params.get('period') ?? ''
  const { backend, session, config, stores } = useApp()
  const store = stores.find((s) => s.id === session?.storeId)

  const checkType: CheckType = type === 'weekly' ? 'weekly' : 'daily'
  const items = useMemo(
    () => resolveItems(config, store, checkType),
    [config, store, checkType],
  )
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.storeId || !period) return
    setLoading(true)
    void backend
      .getSubmission(checkType, period, session.storeId)
      .then(setSubmission)
      .finally(() => setLoading(false))
  }, [backend, checkType, period, session?.storeId])

  const refresh = async () => {
    if (session?.storeId) {
      setSubmission(await backend.getSubmission(checkType, period, session.storeId))
    }
  }

  const done = items.filter((i) => (submission?.items[i.id]?.length ?? 0) > 0).length
  const complete = done >= items.length

  return (
    <div className="min-h-dvh bg-slate-50 pb-16">
      <Header
        title={checkType === 'daily' ? 'デイリーチェック' : 'ウィークリーチェック'}
        backTo="/staff"
      />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">提出先</p>
              <p className="font-bold text-brand-800">
                {checkType === 'daily' ? formatDateKeyLong(period) : formatWeekKey(period)}
              </p>
            </div>
            {complete ? (
              <Badge color="green">全項目 提出済み</Badge>
            ) : (
              <Badge color={done > 0 ? 'yellow' : 'slate'}>{done} / {items.length} 項目</Badge>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-500' : 'bg-brand-500'}`}
              style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            1枚送るごとに自動保存されます。途中で中断しても、送った分はやり直し不要です。
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="text-brand-600" />
          </div>
        ) : (
          items.map((item) => (
            <PhotoSlot
              key={item.id}
              item={item}
              type={checkType}
              period={period}
              photos={submission?.items[item.id] ?? []}
              onChanged={refresh}
            />
          ))
        )}

        {complete && !loading && (
          <div className="rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200">
            <p className="text-lg font-bold text-emerald-800">おつかれさまでした！</p>
            <p className="mt-1 text-sm text-emerald-700">
              全{items.length}項目の提出が完了しました。撮り直したい場合は各項目から差し替えできます。
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

type SlotState = { status: 'idle' | 'uploading' | 'error'; progressText?: string; error?: string }

function PhotoSlot({
  item,
  type,
  period,
  photos,
  onChanged,
}: {
  item: CheckItem
  type: CheckType
  period: string
  photos: { id: string; url: string; uploadedAt: number }[]
  onChanged: () => Promise<void>
}) {
  const { backend, session } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<SlotState>({ status: 'idle' })
  const maxPhotos = item.multi ? (item.maxPhotos ?? BRAND.multiPhotoMax) : 1
  const hasPhoto = photos.length > 0

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !session?.storeId) return
    const list = Array.from(files).slice(0, maxPhotos - (item.multi ? photos.length : 0))
    let failed = 0
    for (let i = 0; i < list.length; i++) {
      setState({
        status: 'uploading',
        progressText: list.length > 1 ? `${i + 1} / ${list.length} 枚目を送信中…` : '送信中…',
      })
      try {
        const blob = await compressImage(list[i])
        await withRetry(() =>
          backend.uploadPhoto({
            type,
            periodKey: period,
            storeId: session.storeId!,
            itemId: item.id,
            blob,
            append: item.multi === true,
          }),
        )
        // 1枚ごとに途中保存 → 都度画面へ反映
        await onChanged()
      } catch (e) {
        failed++
        // 「送れなかった」ことを本部へ自動記録（送らなかった店舗と区別するため）
        void backend.logError({
          storeId: session.storeId!,
          storeName: session.storeName ?? '',
          context: `${type === 'daily' ? 'デイリー' : 'ウィークリー'}「${item.name}」${i + 1}枚目のアップロード`,
          message: e instanceof Error ? e.message : String(e),
        })
      }
    }
    if (failed > 0) {
      setState({
        status: 'error',
        error: `${failed}枚の送信に失敗しました。電波の良い場所でもう一度お試しください（失敗は本部に自動報告済み）。`,
      })
    } else {
      setState({ status: 'idle' })
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-800">
            {item.name}
            {item.multi && (
              <span className="ml-2 text-xs font-semibold text-slate-400">
                複数枚可（最大{maxPhotos}枚）
              </span>
            )}
          </h3>
          {item.hint && <p className="mt-0.5 text-xs text-slate-500">{item.hint}</p>}
        </div>
        {hasPhoto ? <Badge color="green">提出済み</Badge> : <Badge color="slate">未提出</Badge>}
      </div>

      {/* 撮影済み写真 */}
      {hasPhoto && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              <PhotoImg
                url={p.url}
                alt={`${item.name}の写真`}
                className="aspect-square w-full rounded-xl object-cover"
              />
              <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {formatTime(p.uploadedAt)}
              </span>
              {item.multi && (
                <button
                  aria-label="この写真を削除"
                  onClick={async () => {
                    if (!confirm('この写真を削除しますか？')) return
                    await backend.deletePhoto(type, period, session!.storeId!, item.id, p.id)
                    await onChanged()
                  }}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* カメラ入力: multi 項目のみフォルダ選択可、それ以外は直撮り限定 */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(item.multi ? { multiple: true } : { capture: 'environment' as const })}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {state.status === 'uploading' ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-brand-50 py-3 text-sm font-semibold text-brand-700">
          <Spinner /> {state.progressText}
        </div>
      ) : (
        <>
          {(!hasPhoto || item.multi ? photos.length < maxPhotos : true) && (
            <button
              onClick={() => inputRef.current?.click()}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition active:scale-[0.99] ${
                hasPhoto
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-brand-600 text-white shadow-sm hover:bg-brand-700'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              {hasPhoto
                ? item.multi
                  ? '写真を追加する'
                  : '撮り直して差し替える'
                : item.multi
                  ? '写真を選択・撮影する'
                  : 'カメラで撮影する'}
            </button>
          )}
          {!item.multi && (
            <p className="mt-1.5 text-center text-[11px] text-slate-400">
              不正防止のため、その場でのカメラ撮影のみ受け付けます
            </p>
          )}
        </>
      )}

      {state.status === 'error' && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {state.error}
        </p>
      )}
    </section>
  )
}
