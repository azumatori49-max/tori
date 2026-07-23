import Link from "next/link";
import { monthSummary, recentPaidPayments } from "@/lib/db";
import { currentMonth, formatMonth, formatYen } from "@/lib/format";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ?? "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const month = currentMonth();
  const summary = monthSummary(month);
  const recent = recentPaidPayments(5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">ダッシュボード</h1>
        <span className="text-sm text-slate-500">
          {formatMonth(month)} の状況
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="対象会員数" value={`${summary.total} 名`} />
        <StatCard
          label="入金済み"
          value={`${summary.paid} 名`}
          accent="text-emerald-600"
        />
        <StatCard
          label="未入金"
          value={`${summary.unpaid} 名`}
          accent="text-red-600"
        />
        <StatCard label="入金合計" value={formatYen(summary.paidAmount)} />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">最近の入金</h2>
          <Link
            href="/payments"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            入金チェックへ →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            まだ入金記録がありません。
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 font-medium">会員名</th>
                <th className="py-2 font-medium">対象月</th>
                <th className="py-2 font-medium">金額</th>
                <th className="py-2 font-medium">入金日時</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2">{p.member_name}</td>
                  <td className="py-2">{formatMonth(p.month)}</td>
                  <td className="py-2">{formatYen(p.amount)}</td>
                  <td className="py-2 text-slate-500">{p.paid_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
