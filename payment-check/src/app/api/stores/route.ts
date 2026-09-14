import { NextResponse } from "next/server";
import { requireApiHq } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newId, nowString } from "@/lib/config";
import { parseCsv, looksLikeHeader } from "@/lib/csv";
import type { Store, StoreCsvCode } from "@/lib/types";

const CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;

type CodesInput = { mf: string[]; pos: string[]; mfPrimary: string; posPrimary: string };

async function saveCodes(
  db: Awaited<ReturnType<typeof getDb>>,
  storeId: string,
  codes: CodesInput
): Promise<string | null> {
  const entries: Array<{ kind: "mf" | "pos"; code: string; primary: number }> = [];
  if (codes.mfPrimary.trim())
    entries.push({ kind: "mf", code: codes.mfPrimary.trim(), primary: 1 });
  if (codes.posPrimary.trim())
    entries.push({ kind: "pos", code: codes.posPrimary.trim(), primary: 1 });
  for (const c of codes.mf) {
    if (c.trim()) entries.push({ kind: "mf", code: c.trim(), primary: 0 });
  }
  for (const c of codes.pos) {
    if (c.trim()) entries.push({ kind: "pos", code: c.trim(), primary: 0 });
  }
  for (const e of entries) {
    if (!CODE_RE.test(e.code)) {
      return `コード「${e.code}」が不正です（英数字・-・_、最大32文字）`;
    }
    const dup = await db.get<StoreCsvCode>(
      `SELECT * FROM store_csv_codes WHERE kind = ? AND code = ? AND store_id != ?`,
      [e.kind, e.code, storeId]
    );
    if (dup) return `コード「${e.code}」は他の店舗に登録済みです`;
  }
  await db.run(`DELETE FROM store_csv_codes WHERE store_id = ?`, [storeId]);
  for (const e of entries) {
    await db.run(
      `INSERT INTO store_csv_codes (id, store_id, kind, code, is_primary) VALUES (?, ?, ?, ?, ?)`,
      [newId(), storeId, e.kind, e.code, e.primary]
    );
  }
  return null;
}

// 有効店舗の一覧（取込画面の手動割当用）
export async function GET() {
  const session = requireApiHq();
  if (session instanceof NextResponse) return session;
  const db = await getDb();
  const stores = await db.all<Store>(
    `SELECT id, code, name FROM stores WHERE active = 1 ORDER BY code`
  );
  return NextResponse.json({ stores });
}

// 店舗の追加・更新・有効/無効切替・CSV一括取込
export async function POST(req: Request) {
  const session = requireApiHq();
  if (session instanceof NextResponse) return session;

  const body = (await req.json()) as {
    action: "create" | "update" | "toggle" | "importCsv";
    id?: string;
    code?: string;
    name?: string;
    area?: string;
    active?: boolean;
    codes?: CodesInput;
    csvText?: string;
  };
  const db = await getDb();

  if (body.action === "importCsv") {
    // ヘッダ: 店舗コード,店舗名,エリア
    const rows = parseCsv(body.csvText ?? "");
    const dataRows = rows.length > 0 && looksLikeHeader(rows[0]) ? rows.slice(1) : rows;
    let imported = 0;
    let skipped = 0;
    for (const row of dataRows) {
      const [code, name, area] = row.map((c) => (c ?? "").trim());
      if (!code || !name || !CODE_RE.test(code)) {
        skipped++;
        continue;
      }
      const exists = await db.get(`SELECT id FROM stores WHERE code = ?`, [code]);
      if (exists) {
        skipped++;
        continue;
      }
      await db.run(
        `INSERT INTO stores (id, code, name, area, active, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
        [newId(), code, name, area || null, nowString()]
      );
      imported++;
    }
    return NextResponse.json({ ok: true, imported, skipped });
  }

  if (body.action === "toggle") {
    const store = await db.get<Store>(`SELECT * FROM stores WHERE id = ?`, [
      body.id,
    ]);
    if (!store) {
      return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
    }
    await db.run(`UPDATE stores SET active = ? WHERE id = ?`, [
      store.active === 1 ? 0 : 1,
      store.id,
    ]);
    return NextResponse.json({ ok: true });
  }

  const code = (body.code ?? "").trim();
  const name = (body.name ?? "").trim();
  if (!code || !name) {
    return NextResponse.json(
      { error: "店舗コードと店舗名は必須です" },
      { status: 400 }
    );
  }
  if (!CODE_RE.test(code)) {
    return NextResponse.json(
      { error: "店舗コードは英数字・-・_、最大32文字です" },
      { status: 400 }
    );
  }

  if (body.action === "create") {
    const exists = await db.get(`SELECT id FROM stores WHERE code = ?`, [code]);
    if (exists) {
      return NextResponse.json(
        { error: "この店舗コードは登録済みです" },
        { status: 400 }
      );
    }
    const id = newId();
    await db.run(
      `INSERT INTO stores (id, code, name, area, active, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, code, name, body.area?.trim() || null, body.active === false ? 0 : 1, nowString()]
    );
    if (body.codes) {
      const err = await saveCodes(db, id, body.codes);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id });
  }

  if (body.action === "update") {
    if (!body.id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }
    const exists = await db.get(
      `SELECT id FROM stores WHERE code = ? AND id != ?`,
      [code, body.id]
    );
    if (exists) {
      return NextResponse.json(
        { error: "この店舗コードは登録済みです" },
        { status: 400 }
      );
    }
    await db.run(
      `UPDATE stores SET code = ?, name = ?, area = ?, active = ? WHERE id = ?`,
      [code, name, body.area?.trim() || null, body.active === false ? 0 : 1, body.id]
    );
    if (body.codes) {
      const err = await saveCodes(db, body.id, body.codes);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "不正な操作です" }, { status: 400 });
}
