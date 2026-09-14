import { getDb } from "@/lib/db";
import { buildMonthGrid } from "@/lib/recon";
import { currentMonth } from "@/lib/format";
import type { Store } from "@/lib/types";
import { GridClient } from "./grid-client";

export const dynamic = "force-dynamic";

export default async function GridPage({
  searchParams,
}: {
  searchParams: { store?: string; month?: string };
}) {
  const db = await getDb();
  const stores = await db.all<Store>(
    `SELECT * FROM stores WHERE active = 1 ORDER BY code`
  );
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "")
    ? (searchParams.month as string)
    : currentMonth();
  const store =
    stores.find((s) => s.id === searchParams.store) ?? stores[0] ?? null;

  if (!store) {
    return (
      <p className="py-16 text-center text-sm text-neutral-400">
        有効な店舗がありません。マスタ管理から店舗を追加してください。
      </p>
    );
  }

  const grid = await buildMonthGrid(db, store, month);
  return (
    <GridClient
      stores={stores.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
      grid={JSON.parse(JSON.stringify(grid))}
    />
  );
}
