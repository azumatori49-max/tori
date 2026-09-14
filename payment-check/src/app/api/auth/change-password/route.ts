import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/password";
import { createSessionCookie, getSession } from "@/lib/session";

export async function POST(req: Request) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  const { password, confirm } = (await req.json()) as {
    password?: string;
    confirm?: string;
  };
  const p = password ?? "";
  const err = validatePassword(p);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  if (p !== confirm) {
    return NextResponse.json(
      { error: "確認用パスワードが一致しません" },
      { status: 400 }
    );
  }

  const db = await getDb();
  await db.run(
    `UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`,
    [hashPassword(p), session.uid]
  );
  createSessionCookie({
    uid: session.uid,
    email: session.email,
    name: session.name,
    role: session.role,
    storeId: session.storeId,
    mustChange: false,
  });
  return NextResponse.json({ ok: true, role: session.role });
}
