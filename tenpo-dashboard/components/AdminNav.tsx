"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
	{ href: "/admin", label: "店舗一覧" },
	{ href: "/admin/comments", label: "コメント管理" },
	{ href: "/admin/announcements", label: "お知らせ管理" },
];

export default function AdminNav() {
	const pathname = usePathname();
	return (
		<nav className="admin-nav">
			{LINKS.map((l) => (
				<Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
					{l.label}
				</Link>
			))}
		</nav>
	);
}
