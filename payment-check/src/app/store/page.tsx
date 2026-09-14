import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { DailyReport, Store } from "@/lib/types";
import { StoreReportClient } from "./report-client";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (session.mustChange) redirect("/change-password");
  if (session.role !== "store_staff" || !session.storeId) redirect("/dashboard");

  const db = await getDb();
  const store = await db.get<Store>(`SELECT * FROM stores WHERE id = ?`, [
    session.storeId,
  ]);
  const reports = await db.all<DailyReport>(
    `SELECT * FROM daily_reports WHERE store_id = ? ORDER BY date DESC LIMIT 14`,
    [session.storeId]
  );

  return (
    <StoreReportClient
      userName={session.name}
      storeName={store?.name ?? ""}
      reports={JSON.parse(JSON.stringify(reports))}
    />
  );
}
