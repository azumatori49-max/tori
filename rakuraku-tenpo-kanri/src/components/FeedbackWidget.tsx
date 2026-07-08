import { useEffect, useState } from 'react'
import { useApp } from '@/AppContext'
import { compressImage } from '@/lib/image'
import { withRetry } from '@/lib/retry'
import { Button, Field, Modal, Spinner, inputClass } from './ui'
import { PhotoImg } from './PhotoImg'
import { formatTime } from '@/lib/businessDay'
import type { Feedback } from '@/lib/types'

/**
 * フィードバック送信ボタン（全画面の左上に常駐）
 * 不具合・要望をスクリーンショット付きで本部へ送信できる。
 * 店舗スタッフには管理者からの返信が未読バッジで通知される。
 */
export function FeedbackWidget() {
  const { backend, session } = useApp()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [myFeedback, setMyFeedback] = useState<Feedback[]>([])
  const [unread, setUnread] = useState(0)

  const isStaff = session?.role === 'staff'

  const loadMyFeedback = async () => {
    if (!isStaff || !session?.storeId) return
    const all = await backend.listFeedback()
    const mine = all.filter((f) => f.storeId === session.storeId)
    setMyFeedback(mine)
    setUnread(mine.filter((f) => f.reply && !f.reply.readAt).length)
  }

  useEffect(() => {
    void loadMyFeedback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.storeId])

  const openModal = async () => {
    setOpen(true)
    setSent(false)
    await loadMyFeedback()
    // 開いたら返信を既読化
    for (const f of myFeedback.filter((f) => f.reply && !f.reply.readAt)) {
      await backend.markFeedbackRead(f.id)
    }
    if (unread > 0) void loadMyFeedback()
  }

  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const shot = screenshot ? await compressImage(screenshot) : undefined
      await withRetry(() =>
        backend.submitFeedback(
          {
            storeId: session?.storeId,
            storeName: session?.storeName ?? (session?.role === 'admin' ? '管理者' : '閲覧者'),
            message: message.trim(),
          },
          shot,
        ),
      )
      setMessage('')
      setScreenshot(null)
      setSent(true)
      await loadMyFeedback()
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        aria-label="不具合・要望を送る"
        className="relative flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100 hover:bg-brand-50"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        要望
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="不具合・要望を送る">
        {sent ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="font-bold text-slate-800">送信しました</p>
            <p className="mt-1 text-sm text-slate-500">本部で確認のうえ、必要に応じて返信します。</p>
            <Button className="mt-4" onClick={() => setOpen(false)}>閉じる</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="内容">
              <textarea
                className={`${inputClass} min-h-28`}
                placeholder="例: 写真のアップロードが途中で止まります / ○○の項目を追加してほしい"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>
            <Field label="スクリーンショット添付（任意）">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
              />
            </Field>
            <Button size="lg" onClick={send} disabled={sending || !message.trim()}>
              {sending ? <Spinner /> : '送信する'}
            </Button>

            {isStaff && myFeedback.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-bold text-slate-700">送信履歴と返信</h3>
                <div className="space-y-3">
                  {myFeedback.slice(0, 10).map((f) => (
                    <div key={f.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <p className="text-slate-700">{f.message}</p>
                      {f.screenshotUrl && (
                        <PhotoImg
                          url={f.screenshotUrl}
                          alt="添付スクリーンショット"
                          className="mt-2 h-20 w-20 rounded-lg object-cover"
                        />
                      )}
                      <p className="mt-1 text-xs text-slate-400">{formatTime(f.createdAt)}</p>
                      {f.reply && (
                        <div className="mt-2 rounded-lg bg-brand-50 p-2.5">
                          <p className="text-xs font-bold text-brand-700">本部からの返信</p>
                          <p className="mt-0.5 text-slate-700">{f.reply.message}</p>
                          <p className="mt-1 text-xs text-slate-400">{formatTime(f.reply.createdAt)}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
