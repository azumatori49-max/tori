import { NextResponse } from "next/server";
import { requireApiHq } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newId, nowString } from "@/lib/config";
import { buildMonthGrid } from "@/lib/recon";
import { formatYen } from "@/lib/format";
import type { Store } from "@/lib/types";

// 月次一括確認: 未確認行をまとめて確認済にする
export async function POST(req: Request) {
  const session = requireApiHq();
  if (session instanceof NextResponse) return session;

  const { storeId, month, memo } = (await req.json()) as {
    storeId?: string;
    month?: string;
    memo?: string;
  };
  if (!storeId || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const db = await getDb();
  const store = await db.get<Store>(`SELECT * FROM stores WHERE id = ?`, [
    storeId,
  ]);
  if (!store) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
  }

  const grid = await buildMonthGrid(db, store, month);
  const targets = grid.rows.filter((r) => r.status === "unconfirmed");
  const now = nowString();
  const finalMemo =
    (memo ?? "").trim() ||
    `一括確認済 (累積差額: ${formatYen(grid.unconfirmedDiffTotal)})`;

  await db.transaction(async (tx) => {
    for (const row of targets) {
      const existing = await tx.get<{ id: string }>(
        `SELECT id FROM reviews WHERE store_id = ? AND date = ?`,
        [storeId, row.date]
      );
      if (existing) {
        await tx.run(
          `UPDATE reviews SET status = 'confirmed', memo = ?, auto = 0, updated_by = ?, updated_at = ? WHERE id = ?`,
          [finalMemo, session.uid, now, existing.id]
        );
      } else {
        await tx.run(
          `INSERT INTO reviews (id, store_id, date, status, memo, auto, updated_by, updated_at)
           VALUES (?, ?, ?, 'confirmed', ?, 0, ?, ?)`,
          [newId(), storeId, row.date, finalMemo, session.uid, now]
        );
      }
    }
  });

  return NextResponse.json({ ok: true, confirmed: targets.length });
}
