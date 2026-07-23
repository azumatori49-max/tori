import Link from "next/link";
import { notFound } from "next/navigation";
import { getMember } from "@/lib/db";
import { updateMember } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default function MemberEditPage({
  params,
}: {
  params: { id: string };
}) {
  const member = getMember(Number(params.id));
  if (!member) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">会員を編集</h1>
        <Link
          href="/members"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← 会員一覧へ戻る
        </Link>
      </div>

      <form
        action={updateMember}
        className="space-y-4 rounded-xl bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="id" value={member.id} />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            氏名（必須）
          </label>
          <input
            name="name"
            required
            defaultValue={member.name}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            メールアドレス
          </label>
          <input
            name="email"
            type="email"
            defaultValue={member.email ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            電話番号
          </label>
          <input
            name="phone"
            defaultValue={member.phone ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            月額料金（円）
          </label>
          <input
            name="monthly_fee"
            type="number"
            min={0}
            defaultValue={member.monthly_fee}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            メモ
          </label>
          <textarea
            name="note"
            rows={3}
            defaultValue={member.note ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="active"
            defaultChecked={member.active === 1}
            className="h-4 w-4"
          />
          有効（入金チェックの対象にする）
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700"
        >
          更新する
        </button>
      </form>
    </div>
  );
}
