import { useMemo, useState } from 'react';
import { useStores } from '../../hooks/useStores';
import { APP_NAME } from '../../config';
import type { StoreKey } from '../../types';

interface Props {
  onLoginStore: (storeKey: StoreKey, password: string) => Promise<string | null>;
  onLoginAdmin: (password: string) => Promise<string | null>;
}

export const LoginScreen = ({ onLoginStore, onLoginAdmin }: Props) => {
  const { stores, loading } = useStores();
  const [storeKey, setStoreKey] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sortedStoreEntries = useMemo(
    () =>
      Object.entries(stores).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name, 'ja')
      ),
    [stores]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!storeKey) {
      setError('店舗を選択してください');
      return;
    }
    if (!password) {
      setError('パスワードを入力してください');
      return;
    }
    setBusy(true);
    try {
      const err =
        storeKey === '__admin__'
          ? await onLoginAdmin(password)
          : await onLoginStore(storeKey, password);
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">✅</div>
          <h1 className="text-xl font-black text-text">{APP_NAME}</h1>
          <p className="mt-1 text-xs text-text-muted">店舗ログイン</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-bold text-text-muted">店舗</label>
            <select
              value={storeKey}
              onChange={(e) => setStoreKey(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface2 px-3 py-2.5 text-sm"
              disabled={loading}
            >
              <option value="">{loading ? '読み込み中…' : '店舗を選択...'}</option>
              <option value="__admin__">＊ 管理者</option>
              {sortedStoreEntries.map(([k, v]) => (
                <option key={k} value={k}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-text-muted">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface2 px-3 py-2.5 text-sm"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-ng-bg px-3 py-2 text-xs font-bold text-ng">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-text-muted">
          スタッフ用：店舗を選択しパスワードを入力してください
        </p>
      </div>
    </div>
  );
};
