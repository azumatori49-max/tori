import { NextResponse } from "next/server";
import { requireApiHq } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newId, nowString } from "@/lib/config";

// 本部レビュー保存（確認ステータス + 経理メモ）
export async function POST(req: Request) {
  const session = requireApiHq();
  if (session instanceof NextResponse) return session;

  const { storeId, date, status, memo } = (await req.json()) as {
    storeId?: string;
    date?: string;
    status?: string;
    memo?: string | null;
  };
  if (
    !storeId ||
    !date ||
    !["unconfirmed", "checking", "confirmed"].includes(status ?? "")
  ) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const db = await getDb();
  const now = nowString();
  const existing = await db.get<{ id: string }>(
    `SELECT id FROM reviews WHERE store_id = ? AND date = ?`,
    [storeId, date]
  );
  if (existing) {
    await db.run(
      `UPDATE reviews SET status = ?, memo = ?, auto = 0, updated_by = ?, updated_at = ? WHERE id = ?`,
      [status, memo ?? null, session.uid, now, existing.id]
    );
  } else {
    await db.run(
      `INSERT INTO reviews (id, store_id, date, status, memo, auto, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [newId(), storeId, date, status, memo ?? null, session.uid, now]
    );
  }
  return NextResponse.json({ ok: true });
}
