"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Mapping, PreviewResult, PreviewRow } from "@/lib/imports";

const yen = (n: number) => `¥${Math.abs(n).toLocaleString("ja-JP")}`;
const slash = (d: string) => d.replace(/-/g, "-");

const LABELS = {
  mf: {
    title: "MoneyForward入金CSV取込",
    crumb: "MF入金CSV取込",
    amountLabel: "入金額列",
    columns: [
      ["date", "取引日列"],
      ["amount", "入金額列"],
      ["code", "店舗コード列"],
    ] as Array<[string, string]>,
    previewHead: ["取引日", "入金額", "店舗コード", "特定店舗", "状態"],
    hint: "取引日（入金日）、入金額、店舗コード（振込名義や摘要に含まれるコード）の3列。入金額が0円以下の行は出金行として自動でスキップされます。",
    sampleHeader: "日付,入金額,店舗コード",
    overwriteNote:
      "ON: 同じ営業日・店舗の既存 mf_deposits を DELETE してから INSERT します。1日に複数入金がある場合は CSV の内容に置き換わります（既存の複数件 → CSV の件数になる）。",
    normalNote: "OFF: 同じ営業日・店舗の行は重複としてスキップします（既存優先）。",
  },
  pos: {
    title: "POS現金売上CSV取込",
    crumb: "POS売上CSV取込",
    amountLabel: "現金売上額列",
    columns: [
      ["date", "営業日列"],
      ["code", "店舗コード列"],
      ["cash", "現金売上額列"],
      ["card", "カード売上額列（任意）"],
    ] as Array<[string, string]>,
    previewHead: ["営業日", "店舗コード", "店舗名", "現金売上額", "カード売上額", "状態"],
    hint: "営業日、店舗コード、現金売上額の3列（カード売上額は任意）。店舗マスタに登録のないコードの行は取込対象から除外されます。",
    sampleHeader: "日付,店舗コード,現金売上,カード売上",
    overwriteNote:
      "ON: 同じ営業日・店舗の既存 pos_sales を CSV 値で置き換えます。",
    normalNote: "OFF: 既存行があるとスキップ（既存値を保持）。",
  },
};

function statusBadge(row: PreviewRow, kind: "mf" | "pos") {
  switch (row.status) {
    case "ok":
      return <span className="badge bg-emerald-100 text-emerald-700">OK</span>;
    case "unmatched":
      return (
        <span className="badge bg-amber-100 text-amber-700">
          {kind === "mf" ? "未特定" : "未マッチ"}
        </span>
      );
    case "dup":
      return (
        <span className="badge bg-neutral-200 text-neutral-600">
          スキップ（重複）
        </span>
      );
    case "excluded":
      return (
        <span className="badge bg-neutral-200 text-neutral-600">
          スキップ（出金行）
        </span>
      );
    case "error":
      return <span className="badge bg-red-100 text-red-700">解釈エラー</span>;
    case "overwrite":
      return <span className="badge bg-sky-100 text-sky-700">上書き</span>;
  }
}

export function ImportWizard({ kind }: { kind: "mf" | "pos" }) {
  const router = useRouter();
  const L = LABELS[kind];
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<{ name: string; size: number; text: string; encoding: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [stores, setStores] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; overwritten: number } | null>(null);
  const [confirmAssign, setConfirmAssign] = useState<{ code: string; storeId: string; current: string; next: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => setStores(d.stores ?? []))
      .catch(() => {});
  }, []);

  async function runPreview(
    text: string,
    map: Mapping | null,
    ow: boolean,
    assign: Record<string, string>
  ) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${kind}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mapping: map, overwrite: ow, assignments: assign }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "previewの生成に失敗しました");
      setPreview(data);
      setMapping(data.mapping);
    } catch (e) {
      setError(e instanceof Error ? e.message : "previewの生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function onFile(f: File) {
    // MoneyForward / POSレジのCSVはShift-JISで出力されることが多いため自動判定する
    const buf = await f.arrayBuffer();
    let text: string;
    let encoding = "UTF-8";
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      text = new TextDecoder("shift_jis").decode(buf);
      encoding = "Shift-JIS";
    }
    const info = { name: f.name, size: f.size, text, encoding };
    setFile(info);
    setAssignments({});
    setOverwrite(false);
    setShowAll(false);
    setStep(2);
    await runPreview(text, null, false, {});
  }

  const requiredKeys = kind === "mf" ? ["date", "amount", "code"] : ["date", "code", "cash"];
  const missingColumns = L.columns
    .filter(([key]) => requiredKeys.includes(key) && (mapping?.[key] ?? -1) < 0)
    .map(([, label]) => label);

  async function execute() {
    if (!file || !preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${kind}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: file.text,
          fileName: file.name,
          mapping,
          overwrite,
          assignments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "取込に失敗しました");
      setResult(data);
      setStep(3);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "取込に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function assignCode(code: string, storeId: string) {
    if (!storeId) return;
    const existing = assignments[code];
    if (existing && existing !== storeId) {
      const cur = stores.find((s) => s.id === existing)?.name ?? "";
      const nxt = stores.find((s) => s.id === storeId)?.name ?? "";
      setConfirmAssign({ code, storeId, current: cur, next: nxt });
      return;
    }
    const next = { ...assignments, [code]: storeId };
    setAssignments(next);
    if (file) runPreview(file.text, mapping, overwrite, next);
  }

  const importCount = preview
    ? preview.counts.ok + (overwrite ? preview.counts.overwrite : 0)
    : 0;

  const c = preview?.counts;

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-400">
        <Link href="/dashboard" className="hover:underline">
          ダッシュボード
        </Link>{" "}
        › {L.crumb}
      </p>
      <h1 className="text-xl font-bold">{L.title}</h1>

      {/* ステップ表示 */}
      <div className="flex items-center gap-2 text-sm">
        {[
          [1, "ファイル選択"],
          [2, "プレビュー & マッピング"],
          [3, "結果"],
        ].map(([n, label], i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-10 bg-neutral-300" />}
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step >= (n as number)
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-200 text-neutral-500"
              }`}
            >
              {n}
            </span>
            <span
              className={
                step >= (n as number) ? "font-medium" : "text-neutral-400"
              }
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {step === 1 && (
        <div
          className="card flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-16 text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
        >
          <p className="text-sm font-medium">
            CSVファイルをドロップ または クリックして選択
          </p>
          <p className="text-xs text-neutral-400">
            UTF-8 / Shift-JIS どちらのCSVも自動判定して読み込みます
          </p>
          <div className="mt-4 w-full max-w-md rounded-lg bg-neutral-50 p-3 text-left text-xs text-neutral-500">
            <p className="font-medium text-neutral-700">必要な列</p>
            <p className="mt-1">{L.hint}</p>
            <p className="mt-2 font-medium text-neutral-700">ヘッダ行の例</p>
            <code className="mt-1 block rounded bg-white px-2 py-1 font-mono text-[11px] text-neutral-700">
              {L.sampleHeader}
            </code>
            <p className="mt-2">
              列名が違っていても、次の画面で手動で列を選べます。
            </p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </div>
      )}

      {step === 2 && file && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-neutral-400">
                  {file.size.toLocaleString()} B / {preview?.rowCount ?? "-"}行 /{" "}
                  {file.encoding}
                  {loading && (
                    <span className="ml-2 text-neutral-500">プレビューを生成中...</span>
                  )}
                </p>
              </div>
            </div>
            <button
              className="btn-outline"
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreview(null);
              }}
            >
              ‹ ファイルを選び直す
            </button>
          </div>

          {/* カラムマッピング */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-bold">カラムマッピング</h3>
            <div className="flex flex-wrap gap-6">
              {L.columns.map(([key, label]) => (
                <div key={key}>
                  <p className="mb-1 text-xs text-neutral-500">{label}</p>
                  <select
                    className="input w-44"
                    value={mapping?.[key] ?? -1}
                    onChange={(e) =>
                      setMapping({ ...(mapping ?? {}), [key]: Number(e.target.value) })
                    }
                  >
                    <option value={-1}>（未選択）</option>
                    {preview?.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {missingColumns.length > 0 && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                「{missingColumns.join("」「")}」が自動で選べませんでした。上の一覧から該当する列を選び、「マッピングを再適用」を押してください。
              </p>
            )}
            <button
              className="btn-outline mt-3"
              disabled={loading}
              onClick={() => file && runPreview(file.text, mapping, overwrite, assignments)}
            >
              マッピングを再適用
            </button>
          </div>

          {/* 取込モード */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-bold">取込モード</h3>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => {
                  setOverwrite(e.target.checked);
                  if (file) runPreview(file.text, mapping, e.target.checked, assignments);
                }}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm">
                既存の同日・同店舗データを上書きする
                <span className="mt-0.5 block text-[11px] leading-relaxed text-neutral-400">
                  {L.overwriteNote}
                  <br />
                  {L.normalNote}
                </span>
              </span>
            </label>
          </div>

          {/* 店舗マッピング状況 */}
          {preview && c && (
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-bold">店舗マッピング状況</h3>
              <div className="flex flex-wrap gap-1.5">
                <span className="badge bg-emerald-100 text-emerald-700">
                  {kind === "mf" ? "特定済み" : "取込対象"} {c.ok + (overwrite ? c.overwrite : 0)}件
                </span>
                {c.unmatched > 0 && (
                  <span className="badge bg-amber-100 text-amber-700">
                    {kind === "mf" ? "未特定" : "未登録コード"} {c.unmatched}件
                  </span>
                )}
                {overwrite && c.overwrite > 0 && (
                  <span className="badge bg-sky-100 text-sky-700">
                    上書き対象 {c.overwrite}件
                  </span>
                )}
                {!overwrite && c.dup > 0 && (
                  <span className="badge bg-neutral-200 text-neutral-600">
                    重複スキップ {c.dup}件
                  </span>
                )}
                {kind === "mf" && c.excluded > 0 && (
                  <span className="badge bg-neutral-200 text-neutral-600">
                    出金行スキップ {c.excluded}件
                  </span>
                )}
                {c.error > 0 && (
                  <span className="badge bg-red-100 text-red-700">
                    解釈エラー {c.error}件
                  </span>
                )}
              </div>

              {kind === "mf" && preview.unmatchedCodes.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-neutral-500">
                    未特定の店舗コードを店舗にマッピングできます。保存すると
                    store_csv_codes に学習され、次回以降は自動マッチします（1
                    店舗に複数店舗コードを紐付け可）。
                  </p>
                  {preview.unmatchedCodes.map((code) => (
                    <div
                      key={code}
                      className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      <span className="text-sm font-medium">{code}</span>
                      <select
                        className="input w-48"
                        value={assignments[code] ?? ""}
                        onChange={(e) => assignCode(code, e.target.value)}
                      >
                        <option value="">店舗を選択</option>
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}（{s.code}）
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              {kind === "pos" && preview.unmatchedCodes.length > 0 && (
                <p className="mt-2 text-xs text-neutral-500">
                  未登録の店舗コード: {preview.unmatchedCodes.join(", ")} →
                  取込対象から除外されます
                </p>
              )}
            </div>
          )}

          {/* プレビュー */}
          {preview && (
            <div className="card overflow-x-auto">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h3 className="text-sm font-bold">
                  プレビュー（{showAll ? `全${preview.rows.length}行` : "先頭10行"}）
                </h3>
                {preview.rows.length > 10 && (
                  <button
                    className="text-xs text-neutral-500 underline hover:text-neutral-900"
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? "先頭10行のみ表示" : `全${preview.rows.length}行を表示`}
                  </button>
                )}
              </div>
              <table className="w-full">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    {L.previewHead.map((h) => (
                      <th key={h} className="th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(showAll ? preview.rows : preview.rows.slice(0, 10)).map((row) => (
                    <tr
                      key={row.index}
                      className={`border-b border-neutral-100 last:border-0 ${
                        row.status === "unmatched" ? "bg-amber-50/60" : ""
                      }`}
                    >
                      <td className="td">{row.date ? slash(row.date) : "—"}</td>
                      {kind === "mf" ? (
                        <>
                          <td className="td tabular-nums">
                            {row.amount !== null ? yen(row.amount) : "—"}
                          </td>
                          <td className="td">{row.code || "—"}</td>
                          <td className="td">
                            {row.storeName ? (
                              <span className="badge bg-emerald-50 text-emerald-700">
                                {row.storeName}
                                {row.matchedVia === "code" ? " (code)" : ""}
                              </span>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="td">{row.code || "—"}</td>
                          <td className="td">
                            {row.storeName ?? (
                              <span className="text-amber-600">未特定</span>
                            )}
                          </td>
                          <td className="td tabular-nums">
                            {row.amount !== null ? yen(row.amount) : "—"}
                          </td>
                          <td className="td tabular-nums">
                            {row.cardAmount !== null ? yen(row.cardAmount) : "—"}
                          </td>
                        </>
                      )}
                      <td className="td">{statusBadge(row, kind)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              className="btn-outline"
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreview(null);
              }}
            >
              ‹ 戻る
            </button>
            <div className="flex items-center gap-3">
              {!loading && importCount === 0 && preview && (
                <span className="text-xs text-neutral-500">
                  取込対象の行がありません
                </span>
              )}
              <button
                className="btn-primary"
                disabled={loading || importCount === 0 || missingColumns.length > 0}
                onClick={execute}
                title={
                  missingColumns.length > 0
                    ? "必要な列がすべて選択されていません"
                    : undefined
                }
              >
                {loading
                  ? "処理中..."
                  : overwrite
                    ? `上書き取込（${importCount}件） ›`
                    : `取込実行（${importCount}件） ›`}
              </button>
            </div>
          </div>
        </>
      )}

      {step === 3 && result && (
        <div className="card flex flex-col items-center gap-3 p-12">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
            完了
          </span>
          <p className="font-bold">取込が完了しました</p>
          <p className="text-sm text-neutral-500">
            取込 {result.imported}件
            {result.overwritten > 0 && ` / 上書き ${result.overwritten}件`}
          </p>
          <div className="mt-2 flex gap-2">
            <Link href="/history" className="btn-outline">
              取込履歴を見る
            </Link>
            <Link href="/grid" className="btn-outline">
              月次照合で確認する
            </Link>
            <button
              className="btn-primary"
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreview(null);
                setResult(null);
              }}
            >
              新しい取込
            </button>
          </div>
        </div>
      )}

      {confirmAssign && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-bold">マッピングを上書きしますか?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              コード「{confirmAssign.code}」の割当を
              <br />
              {confirmAssign.current} → <strong>{confirmAssign.next}</strong>{" "}
              に変更します。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn-outline"
                onClick={() => setConfirmAssign(null)}
              >
                キャンセル
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  const next = {
                    ...assignments,
                    [confirmAssign.code]: confirmAssign.storeId,
                  };
                  setAssignments(next);
                  setConfirmAssign(null);
                  if (file) runPreview(file.text, mapping, overwrite, next);
                }}
              >
                上書きする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
