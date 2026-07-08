import { useEffect, useState } from 'react'
import { useApp } from '@/AppContext'
import { Header } from '@/components/Header'
import { PhotoImg } from '@/components/PhotoImg'
import { Badge, Button, Spinner, inputClass } from '@/components/ui'
import { formatTime } from '@/lib/businessDay'
import type { Feedback } from '@/lib/types'

/** 現場からの不具合・要望の受信箱。返信すると店舗側に未読バッジで通知される */
export function FeedbackInbox() {
  const { backend } = useApp()
  const [list, setList] = useState<Feedback[] | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')

  const load = async () => setList(await backend.listFeedback())

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header title="現場からの要望・不具合" backTo="/admin" />
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-5">
        {!list ? (
          <div className="flex justify-center py-10"><Spinner className="text-brand-600" /></div>
        ) : list.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">まだフィードバックはありません</p>
        ) : (
          list.map((fb) => (
            <div key={fb.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">{fb.storeName}</span>
                <span className="text-xs text-slate-400">{formatTime(fb.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{fb.message}</p>
              {fb.screenshotUrl && (
                <PhotoImg
                  url={fb.screenshotUrl}
                  alt="添付スクリーンショット"
                  className="mt-2 h-28 w-28 rounded-xl object-cover"
                />
              )}
              {fb.reply ? (
                <div className="mt-3 rounded-xl bg-brand-50 p-3">
                  <div className="flex items-center gap-2">
                    <Badge color="blue">返信済み</Badge>
                    {fb.reply.readAt ? (
                      <span className="text-xs text-slate-400">既読 {formatTime(fb.reply.readAt)}</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-600">未読</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700">{fb.reply.message}</p>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="返信を入力（店舗側に未読バッジで通知されます）"
                    value={replyDrafts[fb.id] ?? ''}
                    onChange={(e) => setReplyDrafts({ ...replyDrafts, [fb.id]: e.target.value })}
                  />
                  <Button
                    size="sm"
                    disabled={!(replyDrafts[fb.id] ?? '').trim() || busyId === fb.id}
                    onClick={async () => {
                      setBusyId(fb.id)
                      try {
                        await backend.replyFeedback(fb.id, replyDrafts[fb.id].trim())
                        await load()
                      } finally {
                        setBusyId('')
                      }
                    }}
                  >
                    返信
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  )
}
