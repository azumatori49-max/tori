import { useMemo, useState } from 'react';
import { ADMIN_PASSWORD } from '../../data/stores';
import type { StoreMap } from '../../hooks/useStores';

interface Props {
  stores: StoreMap;
  storesLoading: boolean;
  onLoginStore: (storeKey: string) => void;
  onLoginAdmin: () => void;
}

export const LoginScreen = ({ stores, storesLoading, onLoginStore, onLoginAdmin }: Props) => {
  const [selected, setSelected] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sortedStores = useMemo(() => {
    return Object.entries(stores)
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [stores]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError('店舗を選択してください');
      return;
    }
    if (selected === '__admin__') {
      if (password === ADMIN_PASSWORD) {
        onLoginAdmin();
      } else {
        setError('管理者パスワードが正しくありません');
      }
      return;
    }
    const store = stores[selected];
    if (!store) {
      setError('店舗が見つかりません');
      return;
    }
    if (store.password !== password) {
      setError('パスワードが正しくありません');
      return;
    }
    onLoginStore(selected);
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3" aria-hidden>
            🐔
          </div>
          <h1 className="text-2xl font-black tracking-wide">鶏ヤロー 衛生管理</h1>
          <p className="text-text-muted text-sm mt-1">店舗を選択してログインしてください</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface rounded-2xl border border-border p-5 space-y-4 shadow-sm"
        >
          <div>
            <label className="block text-xs font-bold mb-1.5">店舗</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={storesLoading}
              className="w-full bg-surface2 border border-border rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">{storesLoading ? '読み込み中...' : '店舗を選択'}</option>
              <option value="__admin__">＊ 管理者</option>
              {sortedStores.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-surface2 border border-border rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {error && (
            <div className="bg-ng-bg text-ng text-xs font-bold rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-accent text-white font-bold rounded-xl py-3 active:scale-[0.98] transition"
          >
            ログイン
          </button>
        </form>

        <p className="text-center text-[11px] text-text-muted mt-6">
          © 鶏ヤロー 衛生管理システム
        </p>
      </div>
    </div>
  );
};
