import { NextResponse } from "next/server";
import { requireApiHq } from "@/lib/auth";
import { getDb } from "@/lib/db";

// 店舗報告の写真は重いので、詳細シートを開いたときだけ取得する
export async function GET(req: Request) {
  const session = requireApiHq();
  if (session instanceof NextResponse) return session;

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId") ?? "";
  const date = url.searchParams.get("date") ?? "";
  if (!storeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const db = await getDb();
  const row = await db.get<{ photos_json: string }>(
    `SELECT photos_json FROM daily_reports WHERE store_id = ? AND date = ?`,
    [storeId, date]
  );
  const photos: string[] = row ? JSON.parse(row.photos_json || "[]") : [];
  return NextResponse.json(
    { photos },
    { headers: { "Cache-Control": "private, max-age=60" } }
  );
}
