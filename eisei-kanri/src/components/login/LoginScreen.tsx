import { useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_PASSWORD } from '../../data/stores';
import type { StoreMap } from '../../hooks/useStores';
import type { SavedCredentials } from '../../hooks/useAuth';

interface Props {
  stores: StoreMap;
  storesLoading: boolean;
  saved: SavedCredentials | null;
  onLoginStore: (storeKey: string, password: string, remember: boolean) => void;
  onLoginAdmin: (password: string, remember: boolean) => void;
  onForget: () => void;
}

const ADMIN_LABEL = '＊ 管理者';

export const LoginScreen = ({
  stores,
  storesLoading,
  saved,
  onLoginStore,
  onLoginAdmin,
  onForget,
}: Props) => {
  const [selected, setSelected] = useState<string>(saved?.storeKey ?? '');
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [password, setPassword] = useState(saved?.password ?? '');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const sortedStores = useMemo(() => {
    return Object.entries(stores)
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [stores]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedStores;
    return sortedStores.filter((s) => s.name.toLowerCase().includes(q));
  }, [sortedStores, search]);

  const selectedLabel = useMemo(() => {
    if (selected === '__admin__') return ADMIN_LABEL;
    if (selected && stores[selected]) return stores[selected]!.name;
    return '';
  }, [selected, stores]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setShowList(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pickStore = (key: string, label: string) => {
    setSelected(key);
    setSearch(label);
    setShowList(false);
  };

  const clearSelection = () => {
    setSelected('');
    setSearch('');
    setShowList(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError('店舗を選択してください');
      return;
    }
    if (selected === '__admin__') {
      if (password === ADMIN_PASSWORD) {
        onLoginAdmin(password, remember);
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
    onLoginStore(selected, password, remember);
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
          <div ref={wrapperRef} className="relative">
            <label className="block text-xs font-bold mb-1.5">店舗</label>
            <div className="relative">
              <input
                type="text"
                value={showList ? search : selectedLabel || search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelected('');
                  setShowList(true);
                }}
                onFocus={() => setShowList(true)}
                placeholder={storesLoading ? '読み込み中...' : '店舗名で検索...'}
                disabled={storesLoading}
                className="w-full bg-surface2 border border-border rounded-xl px-3 py-3 pr-9 text-sm focus:outline-none focus:border-accent"
              />
              {selectedLabel && !showList && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-border flex items-center justify-center text-text-muted"
                  aria-label="クリア"
                >
                  ×
                </button>
              )}
            </div>
            {showList && (
              <div className="absolute z-20 mt-1 w-full bg-surface border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => pickStore('__admin__', ADMIN_LABEL)}
                  className="w-full text-left px-3 py-2 text-sm font-bold text-accent hover:bg-surface2 border-b border-border"
                >
                  {ADMIN_LABEL}
                </button>
                {filtered.length === 0 && (
                  <p className="px-3 py-3 text-xs text-text-muted text-center">
                    該当する店舗はありません
                  </p>
                )}
                {filtered.map((s) => (
                  <button
                    type="button"
                    key={s.key}
                    onClick={() => pickStore(s.key, s.name)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-surface2 ${
                      selected === s.key ? 'bg-surface2 font-bold' : ''
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
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

          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            ログイン情報を保存する
          </label>

          {error && (
            <div className="bg-ng-bg text-ng text-xs font-bold rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-accent text-white font-bold rounded-xl py-3 active:scale-[0.98] transition"
          >
            ログイン
          </button>

          {saved && (
            <button
              type="button"
              onClick={() => {
                onForget();
                setSelected('');
                setSearch('');
                setPassword('');
              }}
              className="w-full text-[11px] text-text-muted underline"
            >
              保存されたログイン情報を消す
            </button>
          )}
        </form>

        <p className="text-center text-[11px] text-text-muted mt-6">
          © 鶏ヤロー 衛生管理システム
        </p>
      </div>
    </div>
  );
};
