import { useMemo, useState } from 'react'
import { useApp } from '@/AppContext'
import { BRAND } from '@/branding'
import { LogoMark } from '@/components/Logo'
import { Button, Field, inputClass } from '@/components/ui'

type Mode = 'select' | 'staff' | 'admin'

/**
 * ログイン画面（3種類の使い方に分岐）
 * 1. 店舗スタッフ: 店舗を選んでパスワード
 * 2. 管理者（本部）: 管理者パスワード
 * 3. 閲覧モード: パスワード不要
 */
export function LoginPage() {
  const { stores, config, login, backend } = useApp()
  const [mode, setMode] = useState<Mode>('select')
  const [storeId, setStoreId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const activeStores = useMemo(
    () => stores.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [stores],
  )

  const submitStaff = () => {
    const store = activeStores.find((s) => s.id === storeId)
    if (!store) {
      setError('店舗を選択してください')
      return
    }
    if (store.password !== password) {
      setError('パスワードが違います')
      return
    }
    login('staff', store.id, store.name)
  }

  const submitAdmin = () => {
    if (password !== config.adminPassword) {
      setError('管理者パスワードが違います')
      return
    }
    login('admin')
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-brand-50 via-white to-brand-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <LogoMark size={96} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-wide text-brand-900">{BRAND.appName}</h1>
          <p className="mt-2 text-sm text-slate-500">{BRAND.tagline}</p>
          {backend.isDemo && (
            <p className="mx-auto mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              デモモードで動作中 — そのまま全機能をお試しいただけます
            </p>
          )}
        </div>

        {mode === 'select' && (
          <div className="space-y-3">
            <button
              onClick={() => { setMode('staff'); setError(''); setPassword('') }}
              className="w-full rounded-2xl bg-brand-600 p-5 text-left text-white shadow-md transition hover:bg-brand-700 active:scale-[0.99]"
            >
              <div className="text-lg font-bold">店舗スタッフの方</div>
              <div className="mt-1 text-sm text-brand-100">毎日のチェックを写真で報告</div>
            </button>
            <button
              onClick={() => { setMode('admin'); setError(''); setPassword('') }}
              className="w-full rounded-2xl bg-white p-5 text-left shadow-md ring-1 ring-brand-100 transition hover:bg-brand-50 active:scale-[0.99]"
            >
              <div className="text-lg font-bold text-brand-800">管理者（本部）の方</div>
              <div className="mt-1 text-sm text-slate-500">全店舗の実施状況を確認・管理</div>
            </button>
            <button
              onClick={() => login('viewer')}
              className="w-full rounded-2xl bg-white p-5 text-left shadow-md ring-1 ring-slate-100 transition hover:bg-slate-50 active:scale-[0.99]"
            >
              <div className="text-lg font-bold text-slate-700">閲覧モード</div>
              <div className="mt-1 text-sm text-slate-500">パスワード不要で「見るだけ」</div>
            </button>
          </div>
        )}

        {mode === 'staff' && (
          <form
            className="space-y-4 rounded-2xl bg-white p-6 shadow-md ring-1 ring-brand-100"
            onSubmit={(e) => { e.preventDefault(); submitStaff() }}
          >
            <h2 className="text-lg font-bold text-slate-800">店舗スタッフ ログイン</h2>
            <Field label="店舗を選択">
              <select
                className={inputClass}
                value={storeId}
                onChange={(e) => { setStoreId(e.target.value); setError('') }}
              >
                <option value="">— 店舗を選んでください —</option>
                {activeStores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="店舗パスワード">
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder={backend.isDemo ? 'デモ用: 1111' : ''}
                autoComplete="current-password"
              />
            </Field>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <Button size="lg" type="submit">ログイン</Button>
            <Button size="lg" variant="ghost" onClick={() => setMode('select')}>戻る</Button>
            <p className="text-xs text-slate-400">
              ログインは一度だけ。この端末に保存され、{BRAND.autoLogoutDays}日間未使用で自動ログアウトします。
            </p>
          </form>
        )}

        {mode === 'admin' && (
          <form
            className="space-y-4 rounded-2xl bg-white p-6 shadow-md ring-1 ring-brand-100"
            onSubmit={(e) => { e.preventDefault(); submitAdmin() }}
          >
            <h2 className="text-lg font-bold text-slate-800">管理者（本部）ログイン</h2>
            <Field label="管理者パスワード">
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder={backend.isDemo ? 'デモ用: admin1234' : ''}
                autoComplete="current-password"
              />
            </Field>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <Button size="lg" type="submit">ログイン</Button>
            <Button size="lg" variant="ghost" onClick={() => setMode('select')}>戻る</Button>
          </form>
        )}
      </div>
      <footer className="pb-6 text-center text-xs text-slate-400">
        {BRAND.appName} — インストール不要のPWA。ブラウザで「ホーム画面に追加」してご利用ください。
      </footer>
    </div>
  )
}
