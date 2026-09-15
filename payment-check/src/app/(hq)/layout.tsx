import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { UserMenu } from "./user-menu";
import { NavLinks } from "./nav-links";
import { DbWarningBanner } from "../db-warning-banner";

export const dynamic = "force-dynamic";

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
      <DbWarningBanner />
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
            <NavLinks />
          </div>
          <UserMenu name={session.name} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
