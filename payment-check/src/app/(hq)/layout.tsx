import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { UserMenu } from "./user-menu";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/grid", label: "月次グリッド" },
  { href: "/import/mf", label: "MF入金CSV" },
  { href: "/import/pos", label: "POS売上CSV" },
  { href: "/history", label: "取込履歴" },
  { href: "/master/users", label: "ユーザー" },
  { href: "/master/stores", label: "店舗" },
];

export default function HqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.mustChange) redirect("/change-password");
  if (session.role !== "hq") redirect("/store");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-5">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 font-bold text-neutral-900"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-xs text-white">
                入
              </span>
              <span className="text-sm">入金確認システム</span>
            </Link>
            <nav className="flex items-center gap-0.5 overflow-x-auto text-sm">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <UserMenu name={session.name} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
