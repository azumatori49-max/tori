"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Store, StoreCsvCode } from "@/lib/types";
import { MasterTabs } from "../master-tabs";

type EditState = {
  id: string | null; // null = 新規
  code: string;
  name: string;
  area: string;
  active: boolean;
  mfPrimary: string;
  posPrimary: string;
  mf: string[];
  pos: string[];
};

export function StoresClient({
  stores,
  codes,
}: {
  stores: Store[];
  codes: StoreCsvCode[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mfInput, setMfInput] = useState("");
  const [posInput, setPosInput] = useState("");
  const csvInput = useRef<HTMLInputElement>(null);

  const areas = useMemo(
    () => Array.from(new Set(stores.map((s) => s.area).filter(Boolean))) as string[],
    [stores]
  );

  const filtered = stores.filter((s) => {
    if (q && !s.name.includes(q) && !s.code.toLowerCase().includes(q.toLowerCase()))
      return false;
    if (areaFilter && s.area !== areaFilter) return false;
    if (stateFilter === "active" && s.active !== 1) return false;
    if (stateFilter === "inactive" && s.active !== 0) return false;
    return true;
  });

  function openEdit(store: Store | null) {
    setError(null);
    setMfInput("");
    setPosInput("");
    if (!store) {
      setEdit({
        id: null,
        code: "",
        name: "",
        area: "",
        active: true,
        mfPrimary: "",
        posPrimary: "",
        mf: [],
        pos: [],
      });
      return;
    }
    const storeCodes = codes.filter((c) => c.store_id === store.id);
    setEdit({
      id: store.id,
      code: store.code,
      name: store.name,
      area: store.area ?? "",
      active: store.active === 1,
      mfPrimary:
        storeCodes.find((c) => c.kind === "mf" && c.is_primary === 1)?.code ?? "",
      posPrimary:
        storeCodes.find((c) => c.kind === "pos" && c.is_primary === 1)?.code ?? "",
      mf: storeCodes
        .filter((c) => c.kind === "mf" && c.is_primary === 0)
        .map((c) => c.code),
      pos: storeCodes
        .filter((c) => c.kind === "pos" && c.is_primary === 0)
        .map((c) => c.code),
    });
  }

  async function save() {
    if (!edit) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: edit.id ? "update" : "create",
        id: edit.id ?? undefined,
        code: edit.code,
        name: edit.name,
        area: edit.area,
        active: edit.active,
        codes: {
          mfPrimary: edit.mfPrimary,
          posPrimary: edit.posPrimary,
          mf: edit.mf,
          pos: edit.pos,
        },
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "保存に失敗しました");
      return;
    }
    setEdit(null);
    router.refresh();
  }

  async function toggle(store: Store) {
    setMenuFor(null);
    await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id: store.id }),
    });
    router.refresh();
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "importCsv", csvText: text }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`店舗CSV取込: ${data.imported}件追加 / ${data.skipped}件スキップ`);
      router.refresh();
    } else {
      alert(data.error ?? "取込に失敗しました");
    }
  }

  return (
    <div className="space-y-4">
      <MasterTabs active="stores" />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 店舗名・コードで検索"
          className="input w-56"
        />
        <select
          className="input w-32"
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
        >
          <option value="">全エリア</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
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
          <button className="btn-outline" onClick={() => csvInput.current?.click()}>
            ↥ CSV取込
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
          <button className="btn-primary" onClick={() => openEdit(null)}>
            + 店舗を追加
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className="th">店舗コード</th>
              <th className="th">店舗名</th>
              <th className="th">エリア</th>
              <th className="th">状態</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((store) => (
              <tr
                key={store.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="td text-neutral-500">{store.code}</td>
                <td className="td font-medium">{store.name}</td>
                <td className="td">{store.area ?? "—"}</td>
                <td className="td">
                  <span
                    className={`badge ${
                      store.active === 1
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-neutral-200 text-neutral-500"
                    }`}
                  >
                    {store.active === 1 ? "有効" : "無効"}
                  </span>
                </td>
                <td className="td relative text-right">
                  <button
                    className="rounded-lg px-2 py-1 text-neutral-400 hover:bg-neutral-100"
                    onClick={() =>
                      setMenuFor(menuFor === store.id ? null : store.id)
                    }
                  >
                    ⋮
                  </button>
                  {menuFor === store.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuFor(null)}
                      />
                      <div className="absolute right-4 z-20 mt-1 w-32 rounded-lg border border-neutral-200 bg-white py-1 text-left shadow-lg">
                        <button
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
                          onClick={() => {
                            openEdit(store);
                            setMenuFor(null);
                          }}
                        >
                          編集
                        </button>
                        <button
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
                          onClick={() => toggle(store)}
                        >
                          {store.active === 1 ? "無効化" : "有効化"}
                        </button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10">
          <div className="card w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">
                {edit.id ? "店舗を編集" : "店舗を追加"}
              </h3>
              <button
                className="text-neutral-400 hover:text-neutral-700"
                onClick={() => setEdit(null)}
              >
                ✕
              </button>
            </div>
            {error && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  店舗コード *
                </label>
                <input
                  className="input"
                  value={edit.code}
                  onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                />
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  英数字 + - / _、最大 32 文字、重複不可
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  店舗名 *
                </label>
                <input
                  className="input"
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  エリア
                </label>
                <input
                  className="input"
                  value={edit.area}
                  onChange={(e) => setEdit({ ...edit, area: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">
                    MF 主コード
                  </label>
                  <input
                    className="input"
                    value={edit.mfPrimary}
                    onChange={(e) =>
                      setEdit({ ...edit, mfPrimary: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">
                    POS 主コード
                  </label>
                  <input
                    className="input"
                    value={edit.posPrimary}
                    onChange={(e) =>
                      setEdit({ ...edit, posPrimary: e.target.value })
                    }
                  />
                </div>
              </div>
              <p className="text-[11px] text-neutral-400">
                主コードは1つだけです。複数のコードを紐付けたいときは下の「副コード」を使ってください。
              </p>
              <label className="flex items-center justify-between text-sm">
                有効
                <input
                  type="checkbox"
                  checked={edit.active}
                  onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
                  className="h-4 w-4"
                />
              </label>

              <div className="border-t border-neutral-200 pt-3">
                <p className="text-sm font-bold">副コード（1 店舗 N コード）</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  銀行や同じ店舗に複数の振込コードを使う場合などに、追加で紐付けられます。CSV
                  取込時にここに登録されたコードでも自動マッチします。
                </p>
                {(
                  [
                    ["mf", "MF 副コード", mfInput, setMfInput],
                    ["pos", "POS 副コード", posInput, setPosInput],
                  ] as const
                ).map(([kind, label, value, setValue]) => (
                  <div key={kind} className="mt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-neutral-600">
                        {label}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {edit[kind].length}件
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {edit[kind].map((code) => (
                        <span
                          key={code}
                          className="badge gap-1 bg-neutral-100 text-neutral-700"
                        >
                          {code}
                          <button
                            className="text-neutral-400 hover:text-red-600"
                            onClick={() =>
                              setEdit({
                                ...edit,
                                [kind]: edit[kind].filter((c) => c !== code),
                              })
                            }
                          >
                            🗑
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 flex gap-2">
                      <input
                        className="input"
                        placeholder={kind === "mf" ? "例: 5678" : "例: POS-2"}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                      />
                      <button
                        className="btn-outline shrink-0"
                        onClick={() => {
                          const v = value.trim();
                          if (v && !edit[kind].includes(v)) {
                            setEdit({ ...edit, [kind]: [...edit[kind], v] });
                          }
                          setValue("");
                        }}
                      >
                        + 追加
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={() => setEdit(null)}>
                キャンセル
              </button>
              <button className="btn-primary" disabled={saving} onClick={save}>
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
