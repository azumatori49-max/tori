"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/grid", label: "月次グリッド" },
  { href: "/import/mf", label: "MF入金CSV" },
  { href: "/import/pos", label: "POS売上CSV" },
  { href: "/history", label: "取込履歴" },
  { href: "/master/users", label: "ユーザー" },
  { href: "/master/stores", label: "店舗" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto text-sm">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] transition ${
              active
                ? "bg-neutral-900 font-medium text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
