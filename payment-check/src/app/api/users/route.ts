import { NextResponse } from "next/server";
import { requireApiHq } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { newId, nowString } from "@/lib/config";
import {
  generatePassword,
  hashPassword,
  validatePassword,
} from "@/lib/password";
import { parseCsv, looksLikeHeader } from "@/lib/csv";
import type { User } from "@/lib/types";

// ユーザーの追加・パスワードリセット・有効/無効・削除・CSV一括取込
export async function POST(req: Request) {
  const session = requireApiHq();
  if (session instanceof NextResponse) return session;

  const body = (await req.json()) as {
    action: "create" | "reset" | "toggle" | "delete" | "importCsv";
    id?: string;
    name?: string;
    email?: string;
    role?: "hq" | "store_staff";
    storeId?: string | null;
    password?: string | null; // 指定なしなら自動生成
    csvText?: string;
  };
  const db = await getDb();

  if (body.action === "importCsv") {
    // ヘッダ: 氏名,メールアドレス,ロール,店舗コード
    const rows = parseCsv(body.csvText ?? "");
    const dataRows = rows.length > 0 && looksLikeHeader(rows[0]) ? rows.slice(1) : rows;
    let imported = 0;
    let skipped = 0;
    const created: Array<{ email: string; password: string }> = [];
    for (const row of dataRows) {
      const [name, email, role, storeCode] = row.map((c) => (c ?? "").trim());
      if (!name || !email || !["hq", "store_staff"].includes(role)) {
        skipped++;
        continue;
      }
      const exists = await db.get(`SELECT id FROM users WHERE email = ?`, [email]);
      if (exists) {
        skipped++;
        continue;
      }
      let storeId: string | null = null;
      if (role === "store_staff") {
        const store = await db.get<{ id: string }>(
          `SELECT id FROM stores WHERE code = ?`,
          [storeCode]
        );
        if (!store) {
          skipped++;
          continue;
        }
        storeId = store.id;
      }
      const password = generatePassword();
      await db.run(
        `INSERT INTO users (id, name, email, password_hash, role, store_id, active, must_change_password, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        [newId(), name, email, hashPassword(password), role, storeId, nowString()]
      );
      created.push({ email, password });
      imported++;
    }
    return NextResponse.json({ ok: true, imported, skipped, created });
  }

  if (body.action === "create") {
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim();
    if (!name || !email || !["hq", "store_staff"].includes(body.role ?? "")) {
      return NextResponse.json(
        { error: "氏名・メールアドレス・ロールは必須です" },
        { status: 400 }
      );
    }
    if (body.role === "store_staff" && !body.storeId) {
      return NextResponse.json(
        { error: "店舗担当者には担当店舗を選択してください" },
        { status: 400 }
      );
    }
    const exists = await db.get(`SELECT id FROM users WHERE email = ?`, [email]);
    if (exists) {
      return NextResponse.json(
        { error: "このメールアドレスは登録済みです" },
        { status: 400 }
      );
    }
    let password = body.password?.trim() || "";
    if (password) {
      const err = validatePassword(password);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    } else {
      password = generatePassword();
    }
    await db.run(
      `INSERT INTO users (id, name, email, password_hash, role, store_id, active, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)`,
      [
        newId(),
        name,
        email,
        hashPassword(password),
        body.role,
        body.role === "store_staff" ? body.storeId : null,
        nowString(),
      ]
    );
    return NextResponse.json({ ok: true, initialPassword: password });
  }

  const user = body.id
    ? await db.get<User>(`SELECT * FROM users WHERE id = ?`, [body.id])
    : undefined;
  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  if (body.action === "reset") {
    let password = body.password?.trim() || "";
    if (password) {
      const err = validatePassword(password);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    } else {
      password = generatePassword();
    }
    await db.run(
      `UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`,
      [hashPassword(password), user.id]
    );
    return NextResponse.json({ ok: true, newPassword: password });
  }

  if (body.action === "toggle") {
    await db.run(`UPDATE users SET active = ? WHERE id = ?`, [
      user.active === 1 ? 0 : 1,
      user.id,
    ]);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    if (user.id === session.uid) {
      return NextResponse.json(
        { error: "自分自身は削除できません。無効化を使ってください" },
        { status: 400 }
      );
    }
    const hasImports = await db.get(
      `SELECT id FROM csv_imports WHERE imported_by = ? LIMIT 1`,
      [user.id]
    );
    if (hasImports) {
      return NextResponse.json(
        { error: "取込履歴があるため削除できません。無効化を使ってください" },
        { status: 400 }
      );
    }
    await db.run(`DELETE FROM users WHERE id = ?`, [user.id]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "不正な操作です" }, { status: 400 });
}
