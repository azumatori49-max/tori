import { getDb } from "@/lib/db";
import type { Store, User } from "@/lib/types";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const db = await getDb();
  const users = await db.all<User & { store_name: string | null }>(
    `SELECT u.*, s.name AS store_name
     FROM users u
     LEFT JOIN stores s ON s.id = u.store_id
     ORDER BY u.created_at`
  );
  const stores = await db.all<Store>(
    `SELECT * FROM stores WHERE active = 1 ORDER BY code`
  );
  return (
    <UsersClient
      users={JSON.parse(JSON.stringify(users))}
      stores={JSON.parse(JSON.stringify(stores))}
    />
  );
}
