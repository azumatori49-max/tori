import Link from "next/link";

export function MasterTabs({ active }: { active: "users" | "stores" }) {
  return (
    <div>
      <h1 className="text-xl font-bold">マスタ管理</h1>
      <div className="mt-3 flex gap-1">
        <Link
          href="/master/users"
          className={`rounded-lg px-3 py-1.5 text-sm transition ${
            active === "users"
              ? "bg-neutral-200 font-medium text-neutral-900"
              : "text-neutral-500 hover:bg-neutral-100"
          }`}
        >
          ユーザー
        </Link>
        <Link
          href="/master/stores"
          className={`rounded-lg px-3 py-1.5 text-sm transition ${
            active === "stores"
              ? "bg-neutral-200 font-medium text-neutral-900"
              : "text-neutral-500 hover:bg-neutral-100"
          }`}
        >
          店舗
        </Link>
      </div>
    </div>
  );
}
