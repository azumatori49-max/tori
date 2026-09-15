"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DayRow, MonthGrid } from "@/lib/recon";

const yen = (n: number) => {
  const sign = n < 0 ? "-" : "";
  return `${sign}¥${Math.abs(n).toLocaleString("ja-JP")}`;
};
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}
function shiftMonth(month: string, diff: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + diff, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${Number(m)}月`;
}
function fmtDateJa(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日 (${weekday(date)})`;
}

function SourceBadge({ source }: { source: DayRow["source"] }) {
  if (!source) return <span className="text-neutral-300">—</span>;
  const styles: Record<string, string> = {
    CSV: "bg-emerald-100 text-emerald-700",
    手動: "bg-sky-100 text-sky-700",
    一部CSV: "bg-amber-100 text-amber-700",
    混在: "bg-violet-100 text-violet-700",
  };
  return <span className={`badge ${styles[source]}`}>{source}</span>;
}

function StatusBadge({ row }: { row: DayRow }) {
  if (row.status === null) return null;
  if (row.status === "confirmed") {
    return (
      <span className="badge bg-emerald-100 text-emerald-700">
        確認済{row.auto ? " (自動)" : ""}
      </span>
    );
  }
  if (row.status === "checking") {
    return <span className="badge bg-sky-100 text-sky-700">確認中</span>;
  }
  return (
    <span className="badge border border-neutral-300 bg-white text-neutral-500">
      未確認
    </span>
  );
}

export function GridClient({
  stores,
  grid,
}: {
  stores: Array<{ id: string; code: string; name: string }>;
  grid: MonthGrid;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<DayRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [photoView, setPhotoView] = useState<string | null>(null);

  const nav = (storeId: string, month: string) =>
    router.push(`/grid?store=${storeId}&month=${month}`);

  return (
    <div className="space-y-4">
      {/* 月・店舗切り替え */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          <button
            className="rounded-md px-2.5 py-1 text-sm hover:bg-neutral-100"
            onClick={() => nav(grid.store.id, shiftMonth(grid.month, -1))}
          >
            ‹ 前月
          </button>
          <span className="px-2 text-sm font-semibold">
            {fmtMonth(grid.month)}
          </span>
          <button
            className="rounded-md px-2.5 py-1 text-sm hover:bg-neutral-100"
            onClick={() => nav(grid.store.id, shiftMonth(grid.month, 1))}
          >
            翌月 ›
          </button>
        </div>
        <select
          className="input w-auto"
          value={grid.store.id}
          onChange={(e) => nav(e.target.value, grid.month)}
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}（{s.code}）
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {/* ヘッダ */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 p-4">
          <div>
            <h1 className="text-lg font-bold">
              {grid.store.name} — {fmtMonth(grid.month)}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              未確認: <strong className="text-neutral-900">{grid.unconfirmedCount}件</strong>
              {" / "}累積差額:{" "}
              <strong className="text-red-600">
                {yen(grid.unconfirmedDiffTotal)}
              </strong>
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              ※確認したい日別行をクリックすると、写真・メモ・手動金額・本部レビューパネルを右に表示します。
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-lg bg-amber-50 px-3 py-1.5 text-right text-xs">
              <span className="mr-3">
                口座入金{" "}
                <strong className="text-sm">{yen(grid.totals.deposit)}</strong>
              </span>
              <span className="mr-3">
                POS売上{" "}
                <strong className="text-sm">{yen(grid.totals.sales)}</strong>
              </span>
              <span>
                差額合計{" "}
                <strong className="text-sm text-red-600">
                  {yen(grid.totals.diff)}
                </strong>
              </span>
            </div>
            <button
              className="btn-outline"
              disabled={grid.unconfirmedCount === 0}
              onClick={() => setBulkOpen(true)}
            >
              全未確認を確認済にする
            </button>
          </div>
        </div>

        {/* グリッド */}
        <table className="w-full">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className="th">日付</th>
              <th className="th text-right">口座入金</th>
              <th className="th text-right">POS売上</th>
              <th className="th text-right">差額</th>
              <th className="th">データ元</th>
              <th className="th">店舗報告</th>
              <th className="th">確認状況</th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => {
              const empty = row.status === null;
              const highlight =
                row.status === "unconfirmed" || row.status === "checking";
              return (
                <tr
                  key={row.date}
                  onClick={() => !empty && setSelected(row)}
                  className={`border-b border-neutral-100 last:border-0 ${
                    empty
                      ? "text-neutral-300"
                      : highlight
                        ? "cursor-pointer bg-amber-50/70 hover:bg-amber-100/70"
                        : "cursor-pointer hover:bg-neutral-50"
                  }`}
                >
                  <td className="td whitespace-nowrap">
                    <span className="font-medium">{row.day}日</span>
                    <span className="ml-1 text-xs text-neutral-400">
                      ({weekday(row.date)})
                    </span>
                  </td>
                  <td className="td text-right tabular-nums">
                    {row.deposit !== null ? yen(row.deposit) : "—"}
                  </td>
                  <td className="td text-right tabular-nums">
                    {row.sales !== null ? yen(row.sales) : "—"}
                  </td>
                  <td
                    className={`td text-right font-semibold tabular-nums ${
                      row.diff === null
                        ? ""
                        : row.diff === 0
                          ? "text-neutral-500"
                          : "text-red-600"
                    }`}
                  >
                    {row.diff !== null ? yen(row.diff) : "—"}
                  </td>
                  <td className="td">
                    <SourceBadge source={row.source} />
                  </td>
                  <td className="td">
                    {row.hasPhotos && (
                      <span className="badge mr-1 bg-neutral-100 text-neutral-600">
                        写真
                      </span>
                    )}
                    {row.hasComment && (
                      <span className="badge bg-neutral-100 text-neutral-600">
                        メモ
                      </span>
                    )}
                    {!row.hasPhotos && !row.hasComment && (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="td">
                    {empty ? (
                      <span className="text-neutral-300">—</span>
                    ) : (
                      <StatusBadge row={row} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t border-neutral-200 px-4 py-2 text-[11px] text-neutral-500">
          データ元アイコン凡例：
          <span className="badge mx-1 bg-emerald-100 text-emerald-700">CSV</span>
          = 自動取込
          <span className="badge mx-1 bg-sky-100 text-sky-700">手動</span>= 店舗入力
          <span className="badge mx-1 bg-amber-100 text-amber-700">一部CSV</span>
          = 片方のみ
          <span className="badge mx-1 bg-violet-100 text-violet-700">混在</span>
          = 後から手動修正
        </div>
      </div>

      {selected && (
        <DetailSheet
          row={selected}
          storeId={grid.store.id}
          storeName={grid.store.name}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            router.refresh();
          }}
          onPhoto={setPhotoView}
        />
      )}

      {bulkOpen && (
        <BulkConfirmDialog
          grid={grid}
          onClose={() => setBulkOpen(false)}
          onDone={() => {
            setBulkOpen(false);
            router.refresh();
          }}
        />
      )}

      {photoView && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPhotoView(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoView}
            alt="店舗報告写真"
            className="max-h-full max-w-full rounded-lg bg-white"
          />
        </div>
      )}
    </div>
  );
}

function DetailSheet({
  row,
  storeId,
  storeName,
  onClose,
  onSaved,
  onPhoto,
}: {
  row: DayRow;
  storeId: string;
  storeName: string;
  onClose: () => void;
  onSaved: () => void;
  onPhoto: (src: string) => void;
}) {
  const initialStatus = row.status ?? "unconfirmed";
  const [status, setStatus] = useState(initialStatus);
  const [memo, setMemo] = useState(row.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const changed = useMemo(
    () => status !== initialStatus || (memo.trim() || "") !== (row.memo ?? ""),
    [status, memo, initialStatus, row.memo]
  );

  async function save() {
    setSaving(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, date: row.date, status, memo: memo.trim() || null }),
    });
    setSaving(false);
    if (res.ok) {
      setSavedMsg(true);
      setTimeout(onSaved, 600);
    }
  }

  const statuses = [
    ["unconfirmed", "未確認"],
    ["checking", "確認中"],
    ["confirmed", "確認済"],
  ] as const;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-neutral-200 p-4">
          <div>
            <h2 className="font-bold">{storeName}</h2>
            <p className="text-xs text-neutral-500">{fmtDateJa(row.date)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* 金額内訳 */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between font-semibold">
              <span>口座入金（実効）</span>
              <span className="tabular-nums">
                {row.deposit !== null ? yen(row.deposit) : "—"}
              </span>
            </div>
            <div className="flex justify-between pl-3 text-xs text-neutral-500">
              <span>└ MF CSV</span>
              <span className="tabular-nums">
                {row.depositCsv !== null ? yen(row.depositCsv) : "—"}
              </span>
            </div>
            {row.depositManual !== null && (
              <div className="flex justify-between pl-3 text-xs text-neutral-500">
                <span>└ 店舗手動</span>
                <span className="tabular-nums">{yen(row.depositManual)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 font-semibold">
              <span>POS売上（実効）</span>
              <span className="tabular-nums">
                {row.sales !== null ? yen(row.sales) : "—"}
              </span>
            </div>
            <div className="flex justify-between pl-3 text-xs text-neutral-500">
              <span>└ POS CSV</span>
              <span className="tabular-nums">
                {row.salesCsv !== null ? yen(row.salesCsv) : "—"}
              </span>
            </div>
            {row.salesManual !== null && (
              <div className="flex justify-between pl-3 text-xs text-neutral-500">
                <span>└ 店舗手動</span>
                <span className="tabular-nums">{yen(row.salesManual)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-200 pt-2 font-semibold">
              <span>差額</span>
              <span
                className={`tabular-nums ${row.diff ? "text-red-600" : ""}`}
              >
                {row.diff !== null ? yen(row.diff) : "—"}
              </span>
            </div>
            <div className="flex justify-between pt-1 text-xs text-neutral-500">
              <span>データ元</span>
              <SourceBadge source={row.source} />
            </div>
          </div>

          {/* 写真 */}
          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">
              写真（{row.report?.photos.length ?? 0}枚）
            </p>
            {row.report && row.report.photos.length > 0 ? (
              <>
                <div className="flex gap-2">
                  {row.report.photos.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt={`店舗報告写真${i + 1}`}
                      onClick={() => onPhoto(src)}
                      className="h-28 w-24 cursor-pointer rounded-md border border-neutral-200 object-cover"
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-neutral-400">
                  ※写真をクリックで拡大
                </p>
              </>
            ) : (
              <p className="text-sm text-neutral-400">未添付</p>
            )}
          </div>

          {/* 店舗コメント */}
          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">
              店舗コメント
            </p>
            {row.report?.comment ? (
              <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm">
                {row.report.comment}
              </p>
            ) : (
              <p className="text-sm text-neutral-400">—</p>
            )}
          </div>

          {/* 本部レビュー */}
          <div className="border-t border-neutral-200 pt-3">
            <p className="mb-2 text-sm font-bold">本部レビュー</p>
            <p className="mb-1 text-xs font-medium text-neutral-500">
              確認ステータス
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {statuses.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                    status === value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mb-1 mt-3 text-xs font-medium text-neutral-500">
              経理メモ
            </p>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="input"
              placeholder="確認内容や対応記録"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              メモは本部スタッフ間でのみ共有されます
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-neutral-200 bg-white p-4">
          <button
            onClick={save}
            disabled={!changed || saving}
            className="btn-primary w-full"
          >
            {savedMsg
              ? "保存しました"
              : saving
                ? "保存中..."
                : changed
                  ? "保存"
                  : "変更なし"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkConfirmDialog({
  grid,
  onClose,
  onDone,
}: {
  grid: MonthGrid;
  onClose: () => void;
  onDone: () => void;
}) {
  const [memo, setMemo] = useState("");
  const [pending, setPending] = useState(false);
  const targets = grid.rows.filter((r) => r.status === "unconfirmed");

  async function run() {
    setPending(true);
    const res = await fetch("/api/reviews/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: grid.store.id, month: grid.month, memo }),
    });
    setPending(false);
    if (res.ok) onDone();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-md p-5 shadow-2xl">
        <h3 className="font-bold">未確認を一括で確認済にします</h3>
        <p className="mt-2 text-sm text-neutral-600">
          対象: <strong>{targets.length}件</strong>（
          {targets.map((t) => `${t.day}日`).join("、")}）
          <br />
          累積差額: <strong>{yen(grid.unconfirmedDiffTotal)}</strong>
        </p>
        <p className="mb-1 mt-3 text-xs font-medium text-neutral-500">
          メモ（任意・全件に同じメモが付きます）
        </p>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className="input"
          placeholder={`一括確認済 (累積差額: ${yen(grid.unconfirmedDiffTotal)})`}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn-primary" disabled={pending} onClick={run}>
            {pending ? "処理中..." : "確認済にする"}
          </button>
        </div>
      </div>
    </div>
  );
}
