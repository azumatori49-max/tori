import { useMemo, useState } from 'react';
import { ADMIN_PASSWORD } from '../../data/stores';
import { sortedStoreEntries } from '../../hooks/useStores';
import { useStoresOnce } from '../../hooks/useStoresOnce';
import type { StoreKey } from '../../types';

interface Props {
  onStoreLogin: (key: StoreKey) => void;
  onAdminLogin: () => void;
}

export const LoginScreen = ({ onStoreLogin, onAdminLogin }: Props) => {
  const { stores, loading } = useStoresOnce();
  const [storeKey, setStoreKey] = useState<string>('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const entries = useMemo(() => sortedStoreEntries(stores), [stores]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!storeKey) {
      setError('店舗を選択してください');
      return;
    }
    if (storeKey === '__admin__') {
      if (password === ADMIN_PASSWORD) {
        onAdminLogin();
      } else {
        setError('管理者パスワードが違います');
      }
      return;
    }
    const store = stores[storeKey];
    if (!store) {
      setError('店舗データが見つかりません');
      return;
    }
    if (store.password !== password) {
      setError('パスワードが違います');
      return;
    }
    onStoreLogin(storeKey);
  };

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <div className="flex-1 px-6 pt-16 pb-8 flex flex-col">
        <div className="flex flex-col items-center text-center gap-4 mb-10">
          <div className="flex items-center justify-center gap-3">
            <img
              src="/logos/toriyaro.png"
              alt="居酒屋それゆけ！鶏ヤロー！"
              className="h-16 w-auto object-contain"
            />
            <img src="/logos/tori.png" alt="鶏" className="h-16 w-auto object-contain" />
            <img
              src="/logos/marusuke.png"
              alt="秩父ホルモン酒場まる助"
              className="h-16 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-wide leading-tight">
              鶏ヤロー・まる助
              <br />
              衛生管理
            </h1>
            <p className="text-xs text-text-muted mt-2">毎日のクリーンを、写真でかんたん。</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-5 flex flex-col gap-4 shadow-sm">
          <div>
            <label className="label" htmlFor="storeKey">
              店舗
            </label>
            <select
              id="storeKey"
              className="input appearance-none"
              value={storeKey}
              onChange={(e) => setStoreKey(e.target.value)}
              disabled={loading}
            >
              <option value="">{loading ? '読み込み中…' : '選択してください'}</option>
              <option value="__admin__">＊ 管理者</option>
              {entries.map(([key, store]) => (
                <option key={key} value={key}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="password">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <div className="text-sm text-ng bg-ng-bg rounded-xl px-3 py-2 font-medium">
              {error}
            </div>
          ) : null}

          <button type="submit" className="btn-primary mt-1">
            ログイン
          </button>
        </form>

        {entries.length === 0 && !loading ? (
          <p className="text-[11px] text-text-muted mt-6 text-center">
            店舗が登録されていません。管理者でログインして「店舗管理」から登録してください。
          </p>
        ) : null}
      </div>

      <footer className="py-4 text-center text-[10px] text-text-muted tracking-wider font-mono">
        TORIYARO × MARUSUKE HYGIENE © 2026
      </footer>
    </div>
  );
};
