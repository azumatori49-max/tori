import { getDb } from "@/lib/db";
import type { CsvImport } from "@/lib/types";
import { HistoryClient } from "./history-client";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const db = await getDb();
  const imports = await db.all<CsvImport & { user_name: string | null }>(
    `SELECT i.*, u.name AS user_name
     FROM csv_imports i
     LEFT JOIN users u ON u.id = i.imported_by
     ORDER BY i.imported_at DESC`
  );
  return <HistoryClient imports={JSON.parse(JSON.stringify(imports))} />;
}
