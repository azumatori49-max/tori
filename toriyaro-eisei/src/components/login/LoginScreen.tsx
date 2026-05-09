import { useMemo, useState } from "react";
import { useStores } from "../../hooks/useStores";
import { ADMIN_PASSWORD } from "../../data/stores";

interface Props {
  onLoginStore: (key: string) => void;
  onLoginAdmin: () => void;
}

export const LoginScreen = ({ onLoginStore, onLoginAdmin }: Props) => {
  const { stores, loading } = useStores();
  const [storeKey, setStoreKey] = useState<string>("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      Object.entries(stores).sort((a, b) =>
        a[1].name.localeCompare(b[1].name, "ja"),
      ),
    [stores],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!storeKey) {
      setError("店舗を選択してください");
      return;
    }
    if (storeKey === "__admin__") {
      if (password === ADMIN_PASSWORD) onLoginAdmin();
      else setError("管理者パスワードが違います");
      return;
    }
    const s = stores[storeKey];
    if (!s) {
      setError("店舗が見つかりません");
      return;
    }
    if (s.password === password) onLoginStore(storeKey);
    else setError("パスワードが違います");
  };

  return (
    <div className="mx-auto flex min-h-full max-w-app flex-col px-5 py-8">
      <div className="mb-8 mt-6 text-center">
        <img
          src="/logo.svg"
          alt=""
          className="mx-auto h-24 w-24 rounded-full shadow-md"
        />
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink">
          鶏ヤロー・まる助 衛生管理
        </h1>
        <p className="mt-1 text-sm text-muted">
          毎日のクリーンを、写真でかんたん。
        </p>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
      >
        <label className="mb-1 block text-xs font-bold text-muted">店舗</label>
        <select
          value={storeKey}
          onChange={(e) => setStoreKey(e.target.value)}
          className="mb-4 w-full rounded-xl border border-border bg-surface2 px-3 py-3 text-sm text-ink"
          disabled={loading}
        >
          <option value="">
            {loading ? "読み込み中…" : "店舗を選択してください"}
          </option>
          <option value="__admin__">＊ 管理者</option>
          {sorted.map(([k, s]) => (
            <option key={k} value={k}>
              {s.name}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-bold text-muted">
          パスワード
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-xl border border-border bg-surface2 px-3 py-3 text-sm text-ink"
          placeholder="••••••••"
        />

        {error && (
          <p className="mt-3 rounded-lg bg-ng-bg px-3 py-2 text-sm text-ng">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="mt-5 w-full rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
          disabled={loading}
        >
          ログイン
        </button>
      </form>

      <p className="mt-auto pt-8 text-center text-[11px] text-muted">
        © 鶏ヤロー・まる助
      </p>
    </div>
  );
};
