import { getDb } from "@/lib/db";
import { buildMonthGrid } from "@/lib/recon";
import { currentMonth } from "@/lib/format";
import type { Store } from "@/lib/types";
import { GridClient } from "./grid-client";

export const dynamic = "force-dynamic";

// 月未指定のときは、その店舗でデータが存在する最新の月を初期表示する
async function latestMonthWithData(
  db: Awaited<ReturnType<typeof getDb>>,
  storeId: string
): Promise<string | null> {
  const rows = await db.all<{ d: string | null }>(
    `SELECT MAX(date) AS d FROM mf_deposits WHERE store_id = ?
     UNION ALL SELECT MAX(date) FROM pos_sales WHERE store_id = ?
     UNION ALL SELECT MAX(date) FROM daily_reports WHERE store_id = ?`,
    [storeId, storeId, storeId]
  );
  const dates = rows.map((r) => r.d).filter((d): d is string => !!d);
  if (dates.length === 0) return null;
  return dates.sort().at(-1)!.slice(0, 7);
}

export default async function GridPage({
  searchParams,
}: {
  searchParams: { store?: string; month?: string };
}) {
  const db = await getDb();
  const stores = await db.all<Store>(
    `SELECT * FROM stores WHERE active = 1 ORDER BY code`
  );
  const store =
    stores.find((s) => s.id === searchParams.store) ?? stores[0] ?? null;

  if (!store) {
    return (
      <p className="py-16 text-center text-sm text-neutral-400">
        有効な店舗がありません。マスタ管理から店舗を追加してください。
      </p>
    );
  }

  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "")
    ? (searchParams.month as string)
    : ((await latestMonthWithData(db, store.id)) ?? currentMonth());

  const grid = await buildMonthGrid(db, store, month);
  return (
    <GridClient
      stores={stores.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
      grid={JSON.parse(JSON.stringify(grid))}
    />
  );
}
