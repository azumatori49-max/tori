"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Store, User } from "@/lib/types";
import { MasterTabs } from "../master-tabs";

type Row = User & { store_name: string | null };

function fmtDateTime(ts: string | null): string {
  if (!ts) return "—";
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}` : ts;
}

export function UsersClient({
  users,
  stores,
}: {
  users: Row[];
  stores: Store[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [csvResult, setCsvResult] = useState<{
    imported: number;
    skipped: number;
    created: Array<{ email: string; password: string }>;
  } | null>(null);
  const [issued, setIssued] = useState<{ title: string; email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const filtered = users.filter((u) => {
    if (q && !u.name.includes(q) && !u.email.toLowerCase().includes(q.toLowerCase()))
      return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (stateFilter === "active" && u.active !== 1) return false;
    if (stateFilter === "inactive" && u.active !== 0) return false;
    return true;
  });

  async function post(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "操作に失敗しました");
      return null;
    }
    return data;
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const data = await post({ action: "importCsv", csvText: text });
    if (data) {
      setCsvResult({
        imported: data.imported,
        skipped: data.skipped,
        created: data.created ?? [],
      });
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <MasterTabs active="users" />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="氏名・メールで検索"
          className="input w-56"
        />
        <select
          className="input w-32"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">全ロール</option>
          <option value="hq">hq（本部担当者）</option>
          <option value="store_staff">store_staff（店舗担当者）</option>
        </select>
        <select
          className="input w-32"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="">全状態</option>
          <option value="active">有効</option>
          <option value="inactive">無効</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button
            className="btn-outline"
            onClick={() => csvInput.current?.click()}
            title="列の順番: 氏名, メールアドレス, ロール(hq / store_staff), 店舗コード（store_staffの場合）"
          >
            CSV取込
          </button>
          <input
            ref={csvInput}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
              e.target.value = "";
            }}
          />
          <button className="btn-primary" onClick={() => setAddOpen(true)}>
            ユーザーを追加
          </button>
        </div>
      </div>

      <p className="text-xs text-neutral-400">
        CSV一括取込の列順: 氏名, メールアドレス, ロール（hq または store_staff）, 店舗コード（店舗担当者のみ）。初期パスワードは自動生成され、取込後に一覧表示されます。
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className="th">氏名</th>
              <th className="th">メール</th>
              <th className="th">ロール</th>
              <th className="th">担当店舗</th>
              <th className="th">状態</th>
              <th className="th">最終ログイン</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr
                key={user.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="td font-medium">{user.name}</td>
                <td className="td text-neutral-500">{user.email}</td>
                <td className="td">
                  <span className="badge bg-neutral-100 text-neutral-700">
                    {user.role}
                  </span>
                </td>
                <td className="td">
                  {user.role === "hq" ? "全店" : (user.store_name ?? "—")}
                </td>
                <td className="td">
                  <span
                    className={`badge ${
                      user.active === 1
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {user.active === 1 ? "有効" : "無効"}
                  </span>
                </td>
                <td className="td text-neutral-500">
                  {fmtDateTime(user.last_login_at)}
                </td>
                <td className="td text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <button
                      className="btn-outline px-2 py-1 text-xs"
                      onClick={() => setResetTarget(user)}
                    >
                      パスワードリセット
                    </button>
                    <button
                      className="btn-outline px-2 py-1 text-xs"
                      onClick={async () => {
                        const data = await post({ action: "toggle", id: user.id });
                        if (data) router.refresh();
                      }}
                    >
                      {user.active === 1 ? "無効化" : "有効化"}
                    </button>
                    <button
                      className="btn-outline border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteTarget(user)}
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddUserDialog
          stores={stores}
          onClose={() => setAddOpen(false)}
          onCreated={(email, password) => {
            setAddOpen(false);
            setIssued({ title: "ユーザーを追加しました", email, password });
            router.refresh();
          }}
        />
      )}

      {resetTarget && (
        <ResetDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={(password) => {
            setIssued({
              title: "パスワードをリセットしました",
              email: resetTarget.email,
              password,
            });
            setResetTarget(null);
            router.refresh();
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-bold">ユーザーを削除しますか？</h3>
            <p className="mt-2 text-sm text-neutral-600">
              {deleteTarget.name}（{deleteTarget.email}）を削除します。この操作は元に戻せません。ログインだけ止めたい場合は「無効化」を使ってください。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setDeleteTarget(null)}>
                キャンセル
              </button>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700"
                onClick={async () => {
                  const data = await post({ action: "delete", id: deleteTarget.id });
                  setDeleteTarget(null);
                  if (data) router.refresh();
                }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {csvResult && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-5 shadow-2xl">
            <h3 className="font-bold">ユーザーCSV取込の結果</h3>
            <p className="mt-2 text-sm text-neutral-600">
              {csvResult.imported}件追加 / {csvResult.skipped}件スキップ
              {csvResult.skipped > 0 &&
                "（必須項目の不足、メールアドレスの重複、存在しない店舗コードの行はスキップされます）"}
            </p>
            {csvResult.created.length > 0 && (
              <>
                <p className="mt-3 text-xs font-medium text-neutral-600">
                  初期パスワード（この画面でしか表示されません）
                </p>
                <div className="mt-1 max-h-60 overflow-y-auto rounded-lg bg-neutral-100 p-3 font-mono text-xs">
                  {csvResult.created.map((c) => (
                    <div key={c.email} className="flex justify-between gap-3 py-0.5">
                      <span className="truncate">{c.email}</span>
                      <span className="shrink-0 font-bold">{c.password}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="mt-4 text-right">
              <button className="btn-primary" onClick={() => setCsvResult(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {issued && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-bold">{issued.title}</h3>
            <p className="mt-2 text-sm text-neutral-600">{issued.email}</p>
            <p className="mt-2 rounded-lg bg-neutral-100 px-3 py-2 text-center font-mono text-lg font-bold tracking-wide">
              {issued.password}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-red-600">
              パスワードはこの画面でしか表示されません。閉じると二度と確認できません。本人へ伝えるまで、この画面を閉じないでください。
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              対象ユーザーは次回ログイン時にパスワードの変更が求められます。
            </p>
            <div className="mt-4 text-right">
              <button className="btn-primary" onClick={() => setIssued(null)}>
                本人へ伝えたので閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddUserDialog({
  stores,
  onClose,
  onCreated,
}: {
  stores: Store[];
  onClose: () => void;
  onCreated: (email: string, password: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"store_staff" | "hq">("store_staff");
  const [storeId, setStoreId] = useState("");
  const [specify, setSpecify] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name,
        email,
        role,
        storeId: storeId || null,
        password: specify ? password : null,
      }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "追加に失敗しました");
      return;
    }
    onCreated(email, data.initialPassword);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">ユーザーを追加</h3>
          <button className="text-neutral-400 hover:text-neutral-700" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          初期パスワードは指定するか、自動生成（14桁）します。どちらの場合も初回ログイン時に変更が強制されます。
        </p>
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              氏名 *
            </label>
            <input
              className="input"
              placeholder="田中太郎"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              メールアドレス *
            </label>
            <input
              className="input"
              type="email"
              placeholder="tanaka@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              ロール *
            </label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as "store_staff" | "hq")}
            >
              <option value="store_staff">store_staff — 店舗担当者</option>
              <option value="hq">hq — 本部担当者</option>
            </select>
          </div>
          {role === "store_staff" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                担当店舗 *
              </label>
              <select
                className="input"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              >
                <option value="">店舗を選択</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}（{s.code}）
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 border-t border-neutral-200 pt-3 text-sm">
            <input
              type="checkbox"
              checked={specify}
              onChange={(e) => setSpecify(e.target.checked)}
              className="h-4 w-4"
            />
            パスワードを指定する（チェックを外すと自動生成）
          </label>
          {specify && (
            <input
              className="input"
              type="text"
              placeholder="8文字以上・英字と数字を含む"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn-primary" disabled={pending} onClick={submit}>
            {pending ? "追加中..." : "ユーザーを追加"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetDialog({
  user,
  onClose,
  onDone,
}: {
  user: Row;
  onClose: () => void;
  onDone: (password: string) => void;
}) {
  const [specify, setSpecify] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reset",
        id: user.id,
        password: specify ? password : null,
      }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "リセットに失敗しました");
      return;
    }
    onDone(data.newPassword);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-5 shadow-2xl">
        <h3 className="font-bold">パスワードリセット</h3>
        <p className="mt-1 text-sm text-neutral-600">
          {user.name}（{user.email}）のパスワードを再発行します。
        </p>
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={specify}
            onChange={(e) => setSpecify(e.target.checked)}
            className="h-4 w-4"
          />
          パスワードを指定する（チェックを外すと自動生成）
        </label>
        {specify && (
          <input
            className="input mt-2"
            type="text"
            placeholder="8文字以上・英字と数字を含む"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn-primary" disabled={pending} onClick={submit}>
            {pending ? "処理中..." : "リセット"}
          </button>
        </div>
      </div>
    </div>
  );
}
