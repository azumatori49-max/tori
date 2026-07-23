import Link from "next/link";
import { listMemberPayments, monthSummary } from "@/lib/db";
import { togglePayment, updatePaymentDetail } from "@/lib/actions";
import {
  currentMonth,
  formatMonth,
  formatYen,
  shiftMonth,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default function PaymentsPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "")
    ? (searchParams.month as string)
    : currentMonth();
  const rows = listMemberPayments(month);
  const summary = monthSummary(month);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">入金チェック</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/payments?month=${shiftMonth(month, -1)}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ← 前月
          </Link>
          <span className="min-w-28 text-center text-lg font-semibold text-slate-900">
            {formatMonth(month)}
          </span>
          <Link
            href={`/payments?month=${shiftMonth(month, 1)}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            翌月 →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="rounded-full bg-white px-4 py-1.5 shadow-sm">
          対象 <strong>{summary.total}</strong> 名
        </span>
        <span className="rounded-full bg-emerald-50 px-4 py-1.5 text-emerald-700 shadow-sm">
          入金済み <strong>{summary.paid}</strong> 名
        </span>
        <span className="rounded-full bg-red-50 px-4 py-1.5 text-red-700 shadow-sm">
          未入金 <strong>{summary.unpaid}</strong> 名
        </span>
        <span className="rounded-full bg-white px-4 py-1.5 shadow-sm">
          入金合計 <strong>{formatYen(summary.paidAmount)}</strong>
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">会員名</th>
              <th className="px-4 py-3 font-medium">状態</th>
              <th className="px-4 py-3 font-medium">金額</th>
              <th className="px-4 py-3 font-medium">入金日時</th>
              <th className="px-4 py-3 font-medium">メモ</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  有効な会員がいません。
                  <Link href="/members" className="text-blue-600 hover:underline">
                    会員管理
                  </Link>
                  から追加してください。
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const paid = row.payment_status === "paid";
              return (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        paid
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {paid ? "入金済み" : "未入金"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={updatePaymentDetail}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="member_id" value={row.id} />
                      <input type="hidden" name="month" value={month} />
                      <input
                        type="number"
                        name="amount"
                        min={0}
                        defaultValue={row.payment_amount ?? row.monthly_fee}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right"
                      />
                      <input
                        type="text"
                        name="note"
                        defaultValue={row.payment_note ?? ""}
                        placeholder="メモ"
                        className="hidden"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        保存
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.paid_at ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.payment_note ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <form action={togglePayment}>
                      <input type="hidden" name="member_id" value={row.id} />
                      <input type="hidden" name="month" value={month} />
                      <button
                        type="submit"
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${
                          paid
                            ? "bg-slate-400 hover:bg-slate-500"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {paid ? "未入金に戻す" : "入金確認"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
