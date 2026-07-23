import Link from "next/link";
import { listMembers } from "@/lib/db";
import { addMember, deleteMember } from "@/lib/actions";
import { formatYen } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function MembersPage() {
  const members = listMembers();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">会員管理</h1>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">会員を追加</h2>
        <form
          action={addMember}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <input
            name="name"
            required
            placeholder="氏名（必須）"
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
          <input
            name="email"
            type="email"
            placeholder="メールアドレス"
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
          <input
            name="phone"
            placeholder="電話番号"
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
          <input
            name="monthly_fee"
            type="number"
            min={0}
            placeholder="月額料金（円）"
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
          >
            追加
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">氏名</th>
              <th className="px-4 py-3 font-medium">メールアドレス</th>
              <th className="px-4 py-3 font-medium">電話番号</th>
              <th className="px-4 py-3 font-medium">月額料金</th>
              <th className="px-4 py-3 font-medium">状態</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  会員が登録されていません。上のフォームから追加してください。
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-500">{m.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {m.name}
                </td>
                <td className="px-4 py-3">{m.email ?? "-"}</td>
                <td className="px-4 py-3">{m.phone ?? "-"}</td>
                <td className="px-4 py-3">{formatYen(m.monthly_fee)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                      m.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {m.active ? "有効" : "無効"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/members/${m.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      編集
                    </Link>
                    <form action={deleteMember}>
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        削除
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
