import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '@/AppContext'
import { BRAND } from '@/branding'
import { Header } from '@/components/Header'
import { AdminNav } from '@/components/AdminNav'
import { Button, Field, inputClass } from '@/components/ui'
import type { CheckItem, CheckType } from '@/lib/types'

/**
 * 設定: 管理者パスワード変更、全店共通チェック項目の編集、古いデータの整理
 */
export function SettingsPage() {
  const { backend, config, refreshConfig } = useApp()
  const [password, setPassword] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [cleaning, setCleaning] = useState(false)

  const flash = (msg: string) => {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-24">
      <Header title="設定" />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        {savedMsg && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
            {savedMsg}
          </p>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="mb-3 font-bold text-slate-800">管理者パスワード</h2>
          <div className="flex gap-2">
            <input
              type="password"
              className={inputClass}
              placeholder="新しいパスワード（8文字以上推奨）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              disabled={password.length < 4}
              onClick={async () => {
                await backend.setAdminPassword(password)
                await refreshConfig()
                setPassword('')
                flash('管理者パスワードを変更しました')
              }}
            >
              変更
            </Button>
          </div>
        </section>

        <ItemsEditor
          type="daily"
          title="デイリーチェック項目（全店共通）"
          items={config.defaultItems.daily}
          onSave={async (items) => {
            await backend.setDefaultItems('daily', items)
            await refreshConfig()
            flash('デイリー項目を保存しました')
          }}
        />
        <ItemsEditor
          type="weekly"
          title="ウィークリーチェック項目（全店共通）"
          items={config.defaultItems.weekly}
          onSave={async (items) => {
            await backend.setDefaultItems('weekly', items)
            await refreshConfig()
            flash('ウィークリー項目を保存しました')
          }}
        />

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="mb-1 font-bold text-slate-800">古いデータの整理</h2>
          <p className="mb-3 text-sm text-slate-500">
            {BRAND.dataRetentionDays}日より前の提出データ・写真・エラーログを削除します。
          </p>
          <Button
            variant="danger"
            disabled={cleaning}
            onClick={async () => {
              if (!confirm(`${BRAND.dataRetentionDays}日より前のデータを削除します。よろしいですか？`)) return
              setCleaning(true)
              try {
                const removed = await backend.cleanupOldData(BRAND.dataRetentionDays)
                flash(`整理が完了しました（${removed}件の提出データを削除）`)
              } finally {
                setCleaning(false)
              }
            }}
          >
            {cleaning ? '整理中…' : '今すぐ整理する'}
          </Button>
        </section>

        <Link
          to="/admin/errors"
          className="block rounded-2xl bg-white p-5 text-center font-bold text-brand-700 shadow-sm ring-1 ring-slate-100 hover:bg-brand-50"
        >
          自動エラーログを見る（送信失敗の記録）
        </Link>
      </main>
      <AdminNav />
    </div>
  )
}

function ItemsEditor({
  type,
  title,
  items,
  onSave,
}: {
  type: CheckType
  title: string
  items: CheckItem[]
  onSave: (items: CheckItem[]) => Promise<void>
}) {
  const [draft, setDraft] = useState<CheckItem[]>(items)
  const [dirty, setDirty] = useState(false)

  const update = (next: CheckItem[]) => {
    setDraft(next)
    setDirty(true)
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-3 font-bold text-slate-800">{title}</h2>
      <div className="space-y-2">
        {draft.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2">
            <input
              className={inputClass}
              value={item.name}
              onChange={(e) =>
                update(draft.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)))
              }
            />
            <label className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500">
              <input
                type="checkbox"
                checked={item.multi ?? false}
                onChange={(e) =>
                  update(
                    draft.map((it, i) =>
                      i === idx
                        ? { ...it, multi: e.target.checked, maxPhotos: e.target.checked ? BRAND.multiPhotoMax : undefined }
                        : it,
                    ),
                  )
                }
                className="h-4 w-4 rounded accent-brand-600"
              />
              複数枚
            </label>
            <button
              aria-label="項目を削除"
              onClick={() => update(draft.filter((_, i) => i !== idx))}
              className="shrink-0 rounded-lg p-2 text-red-500 hover:bg-red-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            update([...draft, { id: `${type}-${Date.now().toString(36)}`, name: '' }])
          }
        >
          ＋ 項目を追加
        </Button>
        <Button
          size="sm"
          disabled={!dirty || draft.some((i) => !i.name.trim())}
          onClick={async () => {
            await onSave(draft.map((i) => ({ ...i, name: i.name.trim() })))
            setDirty(false)
          }}
        >
          保存する
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        店舗ごとの除外・独自項目は「店舗管理」から設定できます。
      </p>
    </section>
  )
}
