import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newId, nowString } from "@/lib/config";

// 店舗スタッフの日次報告（手動金額・コメント・写真）
export async function POST(req: Request) {
  const session = requireApiSession();
  if (session instanceof NextResponse) return session;
  if (session.role !== "store_staff" || !session.storeId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as {
    date?: string;
    manualDeposit?: number | null;
    manualSales?: number | null;
    comment?: string | null;
    photos?: string[];
  };
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: "日付が不正です" }, { status: 400 });
  }
  const photos = (body.photos ?? []).slice(0, 4);
  for (const p of photos) {
    if (!p.startsWith("data:image/") || p.length > 400_000) {
      return NextResponse.json(
        { error: "写真は400KB以下の画像のみ添付できます" },
        { status: 400 }
      );
    }
  }

  const db = await getDb();
  const existing = await db.get<{ id: string }>(
    `SELECT id FROM daily_reports WHERE store_id = ? AND date = ?`,
    [session.storeId, body.date]
  );
  const now = nowString();
  if (existing) {
    await db.run(
      `UPDATE daily_reports SET manual_deposit = ?, manual_sales = ?, comment = ?, photos_json = ?, created_by = ?, updated_at = ? WHERE id = ?`,
      [
        body.manualDeposit ?? null,
        body.manualSales ?? null,
        body.comment?.trim() || null,
        JSON.stringify(photos),
        session.uid,
        now,
        existing.id,
      ]
    );
  } else {
    await db.run(
      `INSERT INTO daily_reports (id, store_id, date, manual_deposit, manual_sales, comment, photos_json, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        session.storeId,
        body.date,
        body.manualDeposit ?? null,
        body.manualSales ?? null,
        body.comment?.trim() || null,
        JSON.stringify(photos),
        session.uid,
        now,
      ]
    );
  }
  return NextResponse.json({ ok: true });
}
