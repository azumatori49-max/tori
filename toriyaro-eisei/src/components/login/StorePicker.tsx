import { useEffect, useMemo, useRef, useState } from 'react';
import { sortedStoreEntries } from '../../hooks/useStores';
import type { Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
  value: string;
  loading?: boolean;
  onChange: (key: string) => void;
}

const ADMIN_VALUE = '__admin__';

export const StorePicker = ({ stores, value, loading, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const entries = useMemo(() => sortedStoreEntries(stores), [stores]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(([, s]) => s.name.toLowerCase().includes(q));
  }, [entries, query]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    if (value === ADMIN_VALUE) return '＊ 管理者';
    return stores[value]?.name ?? null;
  }, [value, stores]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(id);
    };
  }, [open]);

  const choose = (key: string) => {
    onChange(key);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="input flex items-center justify-between text-left gap-2"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedLabel ? 'truncate' : 'text-text-muted truncate'}>
          {selectedLabel ?? (loading ? '店舗一覧を読み込み中…' : '選択してください')}
        </span>
        <svg
          viewBox="0 0 20 20"
          className="w-4 h-4 text-text-muted flex-shrink-0"
          fill="currentColor"
        >
          <path d="M5.5 7.5L10 12l4.5-4.5" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fadeIn">
          <button
            type="button"
            aria-label="閉じる"
            className="absolute inset-0 bg-black/45"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full mx-auto max-w-app bg-bg rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slideUp max-h-[85vh] flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-border bg-surface rounded-t-3xl sm:rounded-t-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-base font-extrabold">店舗を選択</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 rounded-full bg-surface2 hover:bg-border transition flex items-center justify-center text-base"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>
              <input
                ref={inputRef}
                type="search"
                placeholder="店舗名で検索"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input"
                autoComplete="off"
              />
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {!query.trim() ? (
                <>
                  <button
                    type="button"
                    onClick={() => choose(ADMIN_VALUE)}
                    className={`w-full text-left px-5 py-3 hover:bg-surface2 transition flex items-center gap-3 ${
                      value === ADMIN_VALUE ? 'bg-accent/10 text-accent font-bold' : ''
                    }`}
                  >
                    <span className="text-accent font-bold text-lg leading-none">＊</span>
                    <span className="font-bold">管理者</span>
                  </button>
                  <div className="border-t border-border my-1" />
                </>
              ) : null}

              {filtered.length === 0 ? (
                <p className="text-center text-text-muted text-sm py-6">
                  該当する店舗がありません
                </p>
              ) : (
                filtered.map(([key, store]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => choose(key)}
                    className={`w-full text-left px-5 py-3 hover:bg-surface2 transition truncate ${
                      value === key ? 'bg-accent/10 text-accent font-bold' : ''
                    }`}
                  >
                    {store.name}
                  </button>
                ))
              )}
            </div>

            <div className="px-5 py-2 border-t border-border bg-surface text-[11px] text-text-muted text-center font-mono">
              {entries.length} 店舗 {query.trim() ? `／ 検索結果 ${filtered.length} 件` : ''}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
