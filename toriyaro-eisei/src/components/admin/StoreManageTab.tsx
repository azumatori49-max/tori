import { useRef, useState } from 'react';
import { sortedStoreEntries, useStores } from '../../hooks/useStores';
import type { Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
}

const parseCsv = (text: string): Array<{ name: string; password: string }> => {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^店舗名\s*,/.test(line))
    .map((line) => {
      const [name, password] = line.split(',').map((p) => p.trim());
      return { name, password: password || 'Toriyaro1' };
    })
    .filter((row) => !!row.name);
};

export const StoreManageTab = ({ stores }: Props) => {
  const { addStore, addStoresBulk, deleteStore, seedInitialStores } = useStores();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('Toriyaro1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'ng'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const entries = sortedStoreEntries(stores);
  const isEmpty = entries.length === 0;

  const showMessage = (kind: 'ok' | 'ng', text: string) => {
    setMessage({ kind, text });
    setTimeout(() => setMessage(null), 2400);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addStore(name.trim(), password.trim() || 'Toriyaro1');
      setName('');
      setPassword('Toriyaro1');
      setAdding(false);
      showMessage('ok', '店舗を追加しました');
    } catch (err) {
      console.error(err);
      showMessage('ng', '追加に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm('Firebaseに51店舗の初期データを一括登録します。よろしいですか？')) return;
    setBusy(true);
    try {
      await seedInitialStores();
      showMessage('ok', '51店舗を登録しました');
    } catch (err) {
      console.error(err);
      showMessage('ng', '一括登録に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        showMessage('ng', 'CSVから店舗を読み取れませんでした');
        return;
      }
      const count = await addStoresBulk(rows);
      showMessage('ok', `${count}店舗を追加しました`);
    } catch (err) {
      console.error(err);
      showMessage('ng', 'CSV取り込みに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (key: StoreKey, n: string) => {
    if (!confirm(`「${n}」を削除しますか？\n（提出済み写真は残ります）`)) return;
    setBusy(true);
    try {
      await deleteStore(key);
      showMessage('ok', '削除しました');
    } catch (err) {
      console.error(err);
      showMessage('ng', '削除に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="chip bg-surface2 text-text">
          登録店舗: <span className="font-mono font-bold">{entries.length}</span>
        </span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="btn-primary py-2 px-4 text-sm"
        >
          {adding ? 'キャンセル' : '＋ 追加'}
        </button>
      </div>

      {adding ? (
        <form onSubmit={handleAdd} className="card p-4 flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="name">
              店舗名
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="pw">
              パスワード
            </label>
            <input
              id="pw"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary">
            登録
          </button>
        </form>
      ) : null}

      <div className="card p-4 flex flex-col gap-3">
        <p className="font-display text-sm font-extrabold">一括操作</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="btn-ghost py-2.5 text-sm"
        >
          📄 CSVで追加インポート
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCsv}
          className="hidden"
        />
        {isEmpty ? (
          <button
            type="button"
            onClick={handleSeed}
            disabled={busy}
            className="btn-primary py-2.5 text-sm"
          >
            🔥 Firebaseに51店舗を一括登録
          </button>
        ) : null}
        <p className="text-[11px] text-text-muted">
          CSV形式: <span className="font-mono">店舗名,パスワード</span>（1行目はヘッダーで可）
        </p>
      </div>

      {message ? (
        <div
          className={`text-sm rounded-xl px-3 py-2 font-medium ${
            message.kind === 'ok' ? 'bg-ok-bg text-ok' : 'bg-ng-bg text-ng'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {entries.map(([key, store]) => (
          <div key={key} className="card px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold truncate">{store.name}</p>
              <p className="text-[11px] text-text-muted font-mono truncate">{key}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(key, store.name)}
              disabled={busy}
              className="text-ng text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-ng-bg transition"
            >
              削除
            </button>
          </div>
        ))}
        {entries.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-6">
            まだ店舗が登録されていません
          </p>
        ) : null}
      </div>
    </div>
  );
};
