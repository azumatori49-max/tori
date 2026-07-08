import { useMemo, useState } from 'react'
import { useApp } from '@/AppContext'
import { Header } from '@/components/Header'
import { Badge, Button, Field, Modal, inputClass } from '@/components/ui'
import { newId } from '@/lib/backend'
import type { Store } from '@/lib/types'

/**
 * 店舗管理: 追加・名称変更・パスワード管理・項目カスタマイズ（除外/独自項目）・休止/削除
 */
export function StoresPage() {
  const { backend, config, stores, refreshStores } = useApp()
  const [editing, setEditing] = useState<Store | null>(null)
  const [isNew, setIsNew] = useState(false)

  const sorted = useMemo(
    () => [...stores].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [stores],
  )

  const openNew = () => {
    setIsNew(true)
    setEditing({ id: `st-${newId()}`, name: '', password: '', active: true, createdAt: Date.now() })
  }

  const allItems = [...config.defaultItems.daily, ...config.defaultItems.weekly]

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header title="店舗管理" backTo="/admin" />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <Button onClick={openNew}>＋ 店舗を追加</Button>
        <div className="space-y-2">
          {sorted.map((store) => (
            <button
              key={store.id}
              onClick={() => { setIsNew(false); setEditing({ ...store }) }}
              className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-100 hover:ring-brand-200"
            >
              <div className="text-left">
                <div className="font-bold text-slate-800">{store.name}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {store.excludedItemIds?.length ? `除外${store.excludedItemIds.length}項目` : ''}
                  {store.customItems?.daily?.length || store.customItems?.weekly?.length
                    ? ' / 独自項目あり'
                    : ''}
                </div>
              </div>
              {store.active ? <Badge color="green">稼働中</Badge> : <Badge color="slate">休止中</Badge>}
            </button>
          ))}
        </div>
      </main>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={isNew ? '店舗を追加' : '店舗を編集'}
        >
          <div className="space-y-4">
            <Field label="店舗名">
              <input
                className={inputClass}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="例: 新宿本店"
              />
            </Field>
            <Field label="店舗パスワード">
              <input
                className={inputClass}
                value={editing.password}
                onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                placeholder="スタッフがログインに使うパスワード"
              />
            </Field>
            <Field label="除外する項目（この店舗では表示されません）">
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3">
                {allItems.map((item) => {
                  const excluded = editing.excludedItemIds?.includes(item.id) ?? false
                  return (
                    <label key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={excluded}
                        onChange={(e) => {
                          const set = new Set(editing.excludedItemIds ?? [])
                          if (e.target.checked) set.add(item.id)
                          else set.delete(item.id)
                          setEditing({ ...editing, excludedItemIds: [...set] })
                        }}
                        className="h-4 w-4 rounded accent-brand-600"
                      />
                      {item.name}
                    </label>
                  )
                })}
              </div>
            </Field>
            <Field label="この店舗だけの独自項目（デイリー / 1行に1項目）">
              <textarea
                className={`${inputClass} min-h-20`}
                placeholder={'例:\nカウンター清掃\n看板まわり'}
                value={(editing.customItems?.daily ?? []).map((i) => i.name).join('\n')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    customItems: {
                      ...editing.customItems,
                      daily: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((name, idx) => ({
                          id: editing.customItems?.daily?.[idx]?.name === name
                            ? editing.customItems.daily[idx].id
                            : `custom-${editing.id}-d${idx}-${name}`,
                          name,
                        })),
                    },
                  })
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                className="h-4 w-4 rounded accent-brand-600"
              />
              稼働中（オフにするとログイン・集計の対象外）
            </label>

            <Button
              size="lg"
              disabled={!editing.name.trim() || !editing.password}
              onClick={async () => {
                await backend.saveStore({ ...editing, name: editing.name.trim() })
                await refreshStores()
                setEditing(null)
              }}
            >
              保存する
            </Button>
            {!isNew && (
              <Button
                size="lg"
                variant="danger"
                onClick={async () => {
                  if (!confirm(`「${editing.name}」を削除しますか？（提出データは残ります）`)) return
                  await backend.deleteStore(editing.id)
                  await refreshStores()
                  setEditing(null)
                }}
              >
                この店舗を削除
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
