import { getDb } from "@/lib/db";
import type { Store, StoreCsvCode } from "@/lib/types";
import { StoresClient } from "./stores-client";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const db = await getDb();
  const stores = await db.all<Store>(`SELECT * FROM stores ORDER BY code`);
  const codes = await db.all<StoreCsvCode>(`SELECT * FROM store_csv_codes`);
  return (
    <StoresClient
      stores={JSON.parse(JSON.stringify(stores))}
      codes={JSON.parse(JSON.stringify(codes))}
    />
  );
}
