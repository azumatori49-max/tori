import { useMemo, useState, type FC } from 'react';
import { ADMIN_PASSWORD } from '../../lib/firebase';
import { verifyPassword } from '../../lib/crypto';
import type { Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
  loading: boolean;
  onLoginStore: (storeKey: StoreKey) => void;
  onLoginAdmin: () => void;
}

export const LoginScreen: FC<Props> = ({ stores, loading, onLoginStore, onLoginAdmin }) => {
  const [selected, setSelected] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sortedStoreKeys = useMemo(() => {
    return Object.keys(stores).sort((a, b) =>
      stores[a].name.localeCompare(stores[b].name, 'ja'),
    );
  }, [stores]);

  const handleSubmit = async (e: React.FormEvent) => {
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
        setError('管理者パスワードが違います');
      }
      return;
    }
    const store = stores[selected];
    if (!store || !store.passwordHash) {
      setError('店舗情報が不正です');
      return;
    }
    setBusy(true);
    try {
      const ok = await verifyPassword(password, selected, store.passwordHash);
      if (ok) onLoginStore(selected);
      else setError('パスワードが違います');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-bg">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/logo.svg"
            alt="鶏ヤロー まる助"
            className="h-28 w-28 rounded-full shadow-md"
          />
          <h1 className="mt-4 text-xl font-black tracking-tight">鶏ヤロー・まる助 衛生管理</h1>
          <p className="mt-1 text-sm text-text-muted">毎日のクリーンを、写真でかんたん。</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl bg-surface p-6 shadow-sm border border-border"
        >
          <div>
            <label className="mb-1 block text-xs font-bold text-text-muted">店舗</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface2 px-3 py-3 text-sm focus:border-accent focus:outline-none"
              disabled={loading}
            >
              <option value="">{loading ? '店舗を読み込み中…' : '— 選択してください —'}</option>
              <option value="__admin__">＊ 管理者</option>
              {sortedStoreKeys.map((k) => (
                <option key={k} value={k}>
                  {stores[k].name}
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
              className="w-full rounded-xl border border-border bg-surface2 px-3 py-3 text-sm focus:border-accent focus:outline-none"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-ng-bg px-3 py-2 text-xs font-bold text-ng">{error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            disabled={loading || busy}
          >
            {busy ? '確認中…' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
};
