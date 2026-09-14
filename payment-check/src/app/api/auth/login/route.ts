import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSessionCookie } from "@/lib/session";
import { nowString } from "@/lib/config";
import type { User } from "@/lib/types";

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as {
    email?: string;
    password?: string;
  };
  const db = await getDb();
  const user = await db.get<User>(`SELECT * FROM users WHERE email = ?`, [
    (email ?? "").trim(),
  ]);
  if (
    !user ||
    user.active !== 1 ||
    !verifyPassword(password ?? "", user.password_hash)
  ) {
    return NextResponse.json(
      { error: "メールアドレスまたはパスワードが違います" },
      { status: 401 }
    );
  }

  await db.run(`UPDATE users SET last_login_at = ? WHERE id = ?`, [
    nowString(),
    user.id,
  ]);
  createSessionCookie({
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    storeId: user.store_id,
    mustChange: user.must_change_password === 1,
  });
  return NextResponse.json({
    ok: true,
    mustChange: user.must_change_password === 1,
    role: user.role,
  });
}
