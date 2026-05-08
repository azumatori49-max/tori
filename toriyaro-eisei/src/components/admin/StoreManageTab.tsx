import { useState, type FC } from 'react';
import { useStores } from '../../hooks/useStores';
import { INITIAL_STORES } from '../../data/stores';
import type { Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
}

export const StoreManageTab: FC<Props> = ({ stores }) => {
  const { addStore, addStoresBulk, deleteStore, seedInitialStores } = useStores();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('Toriyaro1');
  const [csv, setCsv] = useState('');
  const [showCsv, setShowCsv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sortedKeys = Object.keys(stores).sort((a, b) =>
    stores[a].name.localeCompare(stores[b].name, 'ja'),
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPassword.trim()) return;
    setBusy(true);
    try {
      await addStore(newName.trim(), newPassword.trim());
      setNewName('');
      setShowAdd(false);
      setMessage('店舗を追加しました');
    } catch {
      setMessage('追加に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleCsv = async () => {
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith('店舗名,'));
    const rows = lines
      .map((l) => {
        const [name, password] = l.split(',');
        return name && password ? { name: name.trim(), password: password.trim() } : null;
      })
      .filter((r): r is { name: string; password: string } => !!r);
    if (rows.length === 0) {
      setMessage('CSVに有効な行がありません');
      return;
    }
    setBusy(true);
    try {
      await addStoresBulk(rows);
      setCsv('');
      setShowCsv(false);
      setMessage(`${rows.length}店舗を追加しました`);
    } catch {
      setMessage('CSV追加に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm(`Firebaseに${Object.keys(INITIAL_STORES).length}店舗を一括登録しますか？`)) return;
    setBusy(true);
    try {
      await seedInitialStores();
      setMessage('初期店舗を登録しました');
    } catch {
      setMessage('初期登録に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (key: StoreKey, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    setBusy(true);
    try {
      await deleteStore(key);
      setMessage('削除しました');
    } catch {
      setMessage('削除に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-surface border border-border px-3 py-1 text-xs font-bold">
          登録店舗 <span className="text-accent">{sortedKeys.length}</span>
        </span>
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white"
        >
          ＋ 追加
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-2xl border border-border bg-surface p-3"
        >
          <input
            type="text"
            placeholder="店舗名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="パスワード"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            登録
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowCsv((s) => !s)}
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold"
        >
          CSVで追加インポート
        </button>
        {sortedKeys.length === 0 && (
          <button
            type="button"
            onClick={handleSeed}
            disabled={busy}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            🔥 Firebaseに{Object.keys(INITIAL_STORES).length}店舗を一括登録
          </button>
        )}
      </div>

      {showCsv && (
        <div className="space-y-2 rounded-2xl border border-border bg-surface p-3">
          <p className="text-[11px] text-text-muted">
            形式: <code className="font-mono">店舗名,パスワード</code> （1行1店舗、ヘッダー行は無視）
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm font-mono"
            placeholder="店舗名,パスワード&#10;新宿西口店,Toriyaro1"
          />
          <button
            type="button"
            onClick={handleCsv}
            disabled={busy}
            className="w-full rounded-lg bg-accent py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            インポート実行
          </button>
        </div>
      )}

      {message && (
        <p className="rounded-lg bg-warn-bg px-3 py-2 text-xs font-bold text-warn">
          {message}
        </p>
      )}

      <ul className="space-y-2">
        {sortedKeys.map((k) => (
          <li
            key={k}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{stores[k].name}</p>
              <p className="truncate font-mono text-[10px] text-text-muted">{k}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(k, stores[k].name)}
              disabled={busy}
              className="rounded-md bg-ng-bg px-2 py-1 text-[11px] font-bold text-ng disabled:opacity-50"
            >
              削除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
