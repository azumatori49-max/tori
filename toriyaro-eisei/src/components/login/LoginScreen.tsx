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
  const { stores, loading, error: loadError } = useStoresOnce();
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
        <div className="flex flex-col items-center text-center gap-3 mb-10">
          <img
            src="/logos/toriyaro.png"
            alt="居酒屋それゆけ！鶏ヤロー！"
            className="w-32 h-32 object-contain drop-shadow"
          />
          <h1 className="font-display text-2xl font-extrabold tracking-wide">
            鶏ヤロー・まる助 衛生管理
          </h1>
          <p className="text-xs text-text-muted leading-relaxed px-4">
            店舗の衛生チェック写真をスマホで撮影・提出し、
            <br />
            本部が全店の提出状況をリアルタイム管理。
          </p>
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
            >
              <option value="">
                {loading ? '店舗一覧を読み込み中…' : '選択してください'}
              </option>
              <option value="__admin__">＊ 管理者</option>
              {entries.map(([key, store]) => (
                <option key={key} value={key}>
                  {store.name}
                </option>
              ))}
            </select>
            {loadError && !loading ? (
              <p className="text-[11px] text-warn mt-1">
                店舗一覧を取得できませんでした。管理者ログインで店舗を登録してください。
              </p>
            ) : null}
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
        TORIYARO HYGIENE © 2026
      </footer>
    </div>
  );
};
