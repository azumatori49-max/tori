import { useMemo, useState } from 'react';
import { ADMIN_PASSWORD, INITIAL_STORES } from '../../data/stores';
import { useStores } from '../../hooks/useStores';
import type { StoreKey } from '../../types';

interface Props {
  onLoginStore: (storeKey: StoreKey) => void;
  onLoginAdmin: () => void;
}

export const LoginScreen = ({ onLoginStore, onLoginAdmin }: Props) => {
  const { stores, loading } = useStores();
  const [storeKey, setStoreKey] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const effectiveStores = useMemo(() => {
    const keys = Object.keys(stores);
    if (keys.length > 0) return stores;
    return INITIAL_STORES;
  }, [stores]);

  const sortedStoreEntries = useMemo(
    () =>
      Object.entries(effectiveStores).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name, 'ja')
      ),
    [effectiveStores]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!storeKey) {
      setError('店舗を選択してください');
      return;
    }
    if (storeKey === '__admin__') {
      if (password === ADMIN_PASSWORD) {
        onLoginAdmin();
      } else {
        setError('管理者パスワードが違います');
      }
      return;
    }
    const store = effectiveStores[storeKey];
    if (!store) {
      setError('店舗が見つかりません');
      return;
    }
    if (store.password === password) {
      onLoginStore(storeKey);
    } else {
      setError('パスワードが違います');
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">🐔</div>
          <h1 className="text-xl font-black text-text">鶏ヤロー 衛生管理</h1>
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
              <option value="">店舗を選択...</option>
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
            className="w-full rounded-lg bg-accent py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            ログイン
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-text-muted">
          スタッフ用：店舗を選択しパスワードを入力してください
        </p>
      </div>
    </div>
  );
};
