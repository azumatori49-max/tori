"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CsvImport } from "@/lib/types";

type Row = CsvImport & { user_name: string | null };

function fmtDateTime(ts: string): string {
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}` : ts;
}

function StatusBadge({ row }: { row: Row }) {
  if (row.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="badge bg-emerald-100 text-emerald-700">完了</span>
        {row.mode === "overwrite" && (
          <span className="badge bg-sky-100 text-sky-700">
            上書き{row.overwritten}
          </span>
        )}
      </span>
    );
  }
  if (row.status === "rolled_back") {
    return <span className="badge bg-neutral-200 text-neutral-500">取消済</span>;
  }
  return <span className="badge bg-red-100 text-red-700">失敗</span>;
}

export function HistoryClient({ imports }: { imports: Row[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"mf" | "pos">("mf");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<Row | null>(null);
  const [newMenu, setNewMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = imports.filter((i) => i.kind === tab);

  async function doRollback(row: Row) {
    setError(null);
    const res = await fetch(`/api/history/${row.id}/rollback`, {
      method: "POST",
    });
    const data = await res.json();
    setRollbackTarget(null);
    if (!res.ok) {
      setError(data.error ?? "取込取り消しに失敗しました");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">CSV取込履歴</h1>
        <div className="relative">
          <button className="btn-primary" onClick={() => setNewMenu((v) => !v)}>
            ↥ 新規取込 ▾
          </button>
          {newMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setNewMenu(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
                <Link
                  href="/import/mf"
                  className="block px-3 py-1.5 text-sm hover:bg-neutral-100"
                >
                  MoneyForward入金CSV取込
                </Link>
                <Link
                  href="/import/pos"
                  className="block px-3 py-1.5 text-sm hover:bg-neutral-100"
                >
                  POS現金売上CSV取込
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-1">
        {(
          [
            ["mf", "MoneyForward入金CSV"],
            ["pos", "POS売上CSV"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              tab === k
                ? "bg-neutral-200 font-medium text-neutral-900"
                : "text-neutral-500 hover:bg-neutral-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-neutral-400">
            取込履歴はまだありません
          </p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="th">取込日時</th>
                <th className="th">ファイル名</th>
                <th className="th">取込者</th>
                <th className="th">状態</th>
                <th className="th text-right">件数</th>
                <th className="th text-right">マッチ</th>
                <th className="th text-right">重複</th>
                <th className="th text-right">未特定</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="td whitespace-nowrap text-neutral-500">
                    {fmtDateTime(row.imported_at)}
                  </td>
                  <td className="td font-medium">{row.file_name}</td>
                  <td className="td">{row.user_name ?? "—"}</td>
                  <td className="td">
                    <StatusBadge row={row} />
                  </td>
                  <td className="td text-right tabular-nums">{row.total_rows}</td>
                  <td className="td text-right tabular-nums text-emerald-700">
                    {row.matched}
                  </td>
                  <td className="td text-right tabular-nums">
                    {row.dup_skipped}
                  </td>
                  <td className="td text-right tabular-nums">{row.unmatched}</td>
                  <td className="td relative text-right">
                    <button
                      className="btn-outline"
                      onClick={() =>
                        setMenuFor(menuFor === row.id ? null : row.id)
                      }
                    >
                      操作 ▾
                    </button>
                    {menuFor === row.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuFor(null)}
                        />
                        <div className="absolute right-4 z-20 mt-1 w-36 rounded-lg border border-neutral-200 bg-white py-1 text-left shadow-lg">
                          <button
                            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
                            onClick={() => {
                              setDetail(row);
                              setMenuFor(null);
                            }}
                          >
                            取込詳細
                          </button>
                          {row.status === "completed" && (
                            <button
                              className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setRollbackTarget(row);
                                setMenuFor(null);
                              }}
                            >
                              取込取り消し
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 取込詳細 */}
      {detail && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="card w-full max-w-md p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold">取込詳細</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              {(
                [
                  ["ファイル名", detail.file_name],
                  ["取込日時", fmtDateTime(detail.imported_at)],
                  ["取込者", detail.user_name ?? "—"],
                  [
                    "状態",
                    detail.status === "completed"
                      ? "完了"
                      : detail.status === "rolled_back"
                        ? "取消済"
                        : "失敗",
                  ],
                  ["取込モード", detail.mode === "overwrite" ? "上書き" : "通常"],
                  ["取込件数", `${detail.matched} / ${detail.total_rows}行`],
                  ["重複スキップ", String(detail.dup_skipped)],
                  ["未特定", String(detail.unmatched)],
                  ["対象外・エラー", String(detail.excluded)],
                  ...(detail.mode === "overwrite"
                    ? ([["置換行数", String(detail.overwritten)]] as Array<
                        [string, string]
                      >)
                    : []),
                  ["カラムマッピング", detail.mapping_json],
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-neutral-500">{label}</dt>
                  <dd className="break-all text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 text-right">
              <button className="btn-outline" onClick={() => setDetail(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* rollback確認 */}
      {rollbackTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-5 shadow-2xl">
            <h3 className="font-bold">取込を取り消しますか？</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {rollbackTarget.file_name} の取込で作成された行をすべて削除します。
              手動入力された daily_reports は影響を受けません。この操作は元に戻せません。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn-outline"
                onClick={() => setRollbackTarget(null)}
              >
                キャンセル
              </button>
              <button
                className="btn-primary"
                onClick={() => doRollback(rollbackTarget)}
              >
                取り消す
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
