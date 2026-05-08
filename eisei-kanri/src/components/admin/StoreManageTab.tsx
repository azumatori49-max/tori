import { useRef, useState } from 'react';
import type { StoreMap } from '../../hooks/useStores';
import { useStores } from '../../hooks/useStores';

interface Props {
  stores: StoreMap;
}

export const StoreManageTab = ({ stores }: Props) => {
  const { seedAllStores, addStore, deleteStore, generateStoreKey } = useStores();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('Toriyaro1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const storeCount = Object.keys(stores).length;
  const sortedKeys = Object.keys(stores).sort((a, b) =>
    (stores[a]?.name ?? '').localeCompare(stores[b]?.name ?? '', 'ja'),
  );

  const handleAdd = async () => {
    if (!name.trim() || !password.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const key = generateStoreKey();
      await addStore(key, { name: name.trim(), password: password.trim() });
      setName('');
      setPassword('Toriyaro1');
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (key: string) => {
    const store = stores[key];
    if (!confirm(`「${store?.name ?? key}」を削除しますか？`)) return;
    setBusy(true);
    try {
      await deleteStore(key);
    } finally {
      setBusy(false);
    }
  };

  const handleSeedAll = async () => {
    if (!confirm('Firebaseに51店舗を一括登録します。よろしいですか？')) return;
    setBusy(true);
    setError(null);
    try {
      await seedAllStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let added = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && /店舗名/.test(line)) continue;
        const [n, p] = line.split(',').map((s) => s.trim());
        if (!n || !p) continue;
        const key = generateStoreKey();
        await addStore(key, { name: n, password: p });
        added++;
      }
      alert(`${added}件の店舗を追加しました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV読み込みに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">
          登録店舗数{' '}
          <span className="ml-1 inline-flex items-center justify-center min-w-7 px-2 py-0.5 rounded-full bg-accent text-white text-xs">
            {storeCount}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-xs font-bold bg-accent text-white px-3 py-1.5 rounded-full"
        >
          ＋ 追加
        </button>
      </div>

      {adding && (
        <div className="bg-surface border border-border rounded-2xl p-3 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="店舗名"
            className="w-full bg-surface2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            className="w-full bg-surface2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex-1 text-sm font-bold bg-surface2 rounded-xl py-2"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={busy || !name.trim() || !password.trim()}
              className="flex-1 text-sm font-bold bg-accent text-white rounded-xl py-2 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-sm font-bold bg-surface border border-border rounded-xl py-2.5"
        >
          📄 CSVで追加インポート
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsv}
          className="hidden"
        />
        <p className="text-[11px] text-text-muted">
          フォーマット: <code>店舗名,パスワード</code>（1行目はヘッダー可）
        </p>
      </div>

      {storeCount === 0 && (
        <button
          type="button"
          onClick={handleSeedAll}
          disabled={busy}
          className="w-full text-sm font-bold bg-accent text-white rounded-xl py-3 disabled:opacity-50"
        >
          🔥 Firebaseに51店舗を一括登録
        </button>
      )}

      {error && (
        <div className="bg-ng-bg text-ng text-xs font-bold rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="space-y-2">
        {sortedKeys.map((key) => {
          const store = stores[key];
          if (!store) return null;
          return (
            <div
              key={key}
              className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{store.name}</p>
                <p className="text-[10px] text-text-muted truncate">{key}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(key)}
                disabled={busy}
                className="text-xs font-bold text-ng px-3 py-1.5 rounded-full bg-ng-bg disabled:opacity-50"
              >
                削除
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
