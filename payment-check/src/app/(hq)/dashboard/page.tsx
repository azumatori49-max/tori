import Link from "next/link";
import { getDb } from "@/lib/db";
import { buildDashboard } from "@/lib/recon";
import {
  currentMonth,
  formatDateSlash,
  formatDateTime,
  formatMonth,
  formatYen,
} from "@/lib/format";

export const dynamic = "force-dynamic";

function daysAgo(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts.replace(" ", "T"));
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return `（${diff}日前）`;
}

export default async function DashboardPage() {
  const db = await getDb();
  const data = await buildDashboard(db);
  const month = currentMonth();

  return (
    <div className="space-y-6">
      {/* CSV取込ステータス */}
      <section>
        <h2 className="mb-2 text-xs font-medium text-neutral-500">
          CSV取込ステータス
        </h2>
        <div className="space-y-2">
          {(
            [
              ["MoneyForward入金CSV", data.lastImports.mf, "/import/mf"],
              ["POS売上CSV", data.lastImports.pos, "/import/pos"],
            ] as const
          ).map(([label, ts, href]) => (
            <div
              key={label}
              className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
                ts
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 rounded-full ${ts ? "bg-emerald-500" : "bg-amber-500"}`}
                />
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {label}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {ts
                      ? `最終取込：${formatDateTime(ts)} ${daysAgo(ts)}`
                      : "未取込"}
                  </p>
                </div>
              </div>
              <Link href={href} className="btn-outline">
                取込
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* サマリカード */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-2xl font-bold text-neutral-900">
            {data.diffRows.length}件
          </p>
          <p className="mt-1 text-xs text-neutral-500">差額あり（未確認）</p>
        </div>
        <div className="card border-amber-200 bg-amber-50/60 p-4">
          <p className="text-2xl font-bold text-neutral-900">
            {Math.max(data.missingCsvDays.mf, data.missingCsvDays.pos)}日分
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            CSV未取込（直近7日 / MF:{data.missingCsvDays.mf} POS:
            {data.missingCsvDays.pos}）
          </p>
        </div>
        <div className="card border-red-200 bg-red-50/60 p-4">
          <p className="text-2xl font-bold text-neutral-900">
            {data.noDepositStores.length}店舗
          </p>
          <p className="mt-1 text-xs text-neutral-500">4日連続入金なし</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">当月レビュー</p>
          <p className="mt-1 text-lg font-bold text-neutral-900">
            {formatMonth(month)}
          </p>
          <Link
            href={`/grid?month=${month}`}
            className="mt-1 block text-xs text-neutral-500 underline hover:text-neutral-800"
          >
            差額・確認状況をシートで確認
          </Link>
        </div>
      </section>

      {/* 差額あり（未確認） */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900">
          差額あり（未確認） — {formatMonth(month)}
          <span className="badge border border-neutral-200 bg-white text-neutral-500">
            {data.diffRows.length}件
          </span>
        </h2>
        <div className="card overflow-hidden">
          {data.diffRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-400">
              未確認の差額はありません
            </p>
          ) : (
            <table className="w-full">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="th">店舗</th>
                  <th className="th">日付</th>
                  <th className="th">差額</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {data.diffRows.map((row) => (
                  <tr
                    key={`${row.storeId}-${row.date}`}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="td font-medium">{row.storeName}</td>
                    <td className="td">{formatDateSlash(row.date)}</td>
                    <td className="td font-semibold text-red-600">
                      {formatYen(row.diff)}
                    </td>
                    <td className="td text-right">
                      <Link
                        href={`/grid?store=${row.storeId}&month=${row.month}`}
                        className="text-xs text-neutral-500 underline hover:text-neutral-900"
                      >
                        月次グリッド →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 4日連続入金なし */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">
          4日連続入金なし
        </h2>
        <div className="card overflow-hidden">
          {data.noDepositStores.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-400">
              該当する店舗はありません
            </p>
          ) : (
            <table className="w-full">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="th">店舗</th>
                  <th className="th">連続日数</th>
                  <th className="th">最終入金日</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {data.noDepositStores.map((row) => (
                  <tr
                    key={row.storeId}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="td font-medium">{row.storeName}</td>
                    <td className="td">
                      <span className="badge bg-red-100 text-red-700">
                        {row.streak}日連続
                      </span>
                    </td>
                    <td className="td">
                      {row.lastDate ? formatDateSlash(row.lastDate) : "—"}
                    </td>
                    <td className="td text-right">
                      <Link
                        href={`/grid?store=${row.storeId}&month=${row.month}`}
                        className="text-xs text-neutral-500 underline hover:text-neutral-900"
                      >
                        月次グリッド →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
