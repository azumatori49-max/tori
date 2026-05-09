import { useMemo, useRef, useState } from "react";
import { generateStoreKey, useStores } from "../../hooks/useStores";

export const StoreManageTab = () => {
  const { stores, seedAll, addStore, deleteStore } = useStores();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("Toriyaro1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const sorted = useMemo(
    () =>
      Object.entries(stores).sort((a, b) =>
        a[1].name.localeCompare(b[1].name, "ja"),
      ),
    [stores],
  );

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await addStore(generateStoreKey(), { name: name.trim(), password: pw });
      setName("");
      setMsg("追加しました");
    } finally {
      setBusy(false);
    }
  };

  const onCsv = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      let added = 0;
      for (const line of lines) {
        const [n, p] = line.split(",").map((s) => s.trim());
        if (!n || n === "店舗名") continue;
        await addStore(generateStoreKey(), { name: n, password: p || "Toriyaro1" });
        added++;
      }
      setMsg(`${added}件を追加しました`);
    } finally {
      setBusy(false);
    }
  };

  const onSeed = async () => {
    if (!confirm("Firebaseに50店舗を一括登録します。よろしいですか？")) return;
    setBusy(true);
    setMsg(null);
    try {
      await seedAll();
      setMsg("一括登録が完了しました");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (key: string, n: string) => {
    if (!confirm(`「${n}」を削除しますか？`)) return;
    await deleteStore(key);
  };

  const empty = Object.keys(stores).length === 0;

  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-muted">
          登録店舗{" "}
          <span className="ml-1 rounded-full bg-surface2 px-2 py-0.5 font-mono text-ink">
            {sorted.length}
          </span>
        </span>
      </div>

      {empty && (
        <button
          type="button"
          onClick={onSeed}
          disabled={busy}
          className="mb-3 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          🔥 Firebaseに50店舗を一括登録
        </button>
      )}

      <form
        onSubmit={submitAdd}
        className="mb-3 rounded-2xl border border-border bg-surface p-3"
      >
        <div className="mb-2 text-xs font-bold text-muted">店舗を追加</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="店舗名"
          className="mb-2 w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
        />
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="パスワード"
          className="mb-2 w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="flex-1 rounded-lg bg-accent py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            ＋ 追加
          </button>
          <button
            type="button"
            onClick={() => csvInput.current?.click()}
            disabled={busy}
            className="flex-1 rounded-lg border border-border py-2 text-xs font-bold text-ink"
          >
            CSVで追加インポート
          </button>
          <input
            ref={csvInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCsv(f);
              e.target.value = "";
            }}
          />
        </div>
      </form>

      {msg && (
        <p className="mb-3 rounded-lg bg-ok-bg px-3 py-2 text-xs text-ok">
          {msg}
        </p>
      )}

      <ul className="space-y-2">
        {sorted.map(([k, s]) => (
          <li
            key={k}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-ink">{s.name}</div>
              <div className="font-mono text-[10px] text-muted">{k}</div>
            </div>
            <button
              type="button"
              onClick={() => onDelete(k, s.name)}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-bold text-ng"
            >
              削除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
