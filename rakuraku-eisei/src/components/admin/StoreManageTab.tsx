import { useRef, useState } from 'react';
import type { StoreMap } from '../../hooks/useStores';

interface Props {
  stores: StoreMap;
  onAddStore: (name: string, password: string) => Promise<string>;
  onDeleteStore: (key: string) => Promise<void>;
  onBulkImport: (rows: Array<{ name: string; password: string }>) => Promise<void>;
}

const parseCsv = (text: string): Array<{ name: string; password: string }> => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: Array<{ name: string; password: string }> = [];
  for (const line of lines) {
    const cells = line.split(',').map((c) => c.trim());
    if (cells.length < 2) continue;
    const [name, password] = cells;
    if (name === '店舗名' || name === 'name') continue;
    rows.push({ name, password });
  }
  return rows;
};

export const StoreManageTab = ({
  stores,
  onAddStore,
  onDeleteStore,
  onBulkImport,
}: Props) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const entries = Object.entries(stores).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name, 'ja')
  );

  const handleAdd = async () => {
    if (!name.trim() || !password) return;
    setBusy(true);
    setMsg('');
    try {
      await onAddStore(name.trim(), password);
      setName('');
      setPassword('');
      setShowAdd(false);
      setMsg('追加しました');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '追加に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleCsv = async (file: File) => {
    setBusy(true);
    setMsg('');
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setMsg('CSVに有効な行がありません');
        return;
      }
      await onBulkImport(rows);
      setMsg(`${rows.length}件を追加しました`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'インポート失敗');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (key: string, label: string) => {
    if (!confirm(`「${label}」を削除します。よろしいですか？`)) return;
    try {
      await onDeleteStore(key);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '削除に失敗しました');
    }
  };

  return (
    <div className="px-4 py-4 pb-8">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-text shadow-sm border border-border">
          登録 {entries.length} 店舗
        </span>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-white"
        >
          ＋追加
        </button>
      </div>

      <div className="mb-3 grid gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-text active:bg-surface2"
        >
          CSVで追加インポート
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCsv(f);
          }}
        />
        <p className="text-[11px] text-text-muted">
          CSV形式: 1行につき「店舗名,パスワード」
        </p>
      </div>

      {showAdd && (
        <div className="mb-3 space-y-2 rounded-xl border border-border bg-surface p-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="店舗名"
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !name.trim() || !password}
            className="w-full rounded-lg bg-accent py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            登録
          </button>
        </div>
      )}

      {msg && (
        <div className="mb-3 rounded-lg bg-ok-bg px-3 py-2 text-xs font-bold text-ok">{msg}</div>
      )}

      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-text">{v.name}</div>
              <div className="truncate text-[10px] text-text-muted">{k}</div>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(k, v.name)}
              className="shrink-0 rounded-md border border-ng/30 px-2 py-1 text-xs font-bold text-ng active:bg-ng-bg"
            >
              削除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
