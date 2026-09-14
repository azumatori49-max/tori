import { NextResponse } from "next/server";
import { getSession, type Session } from "./session";

export function requireApiSession(): Session | NextResponse {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  return session;
}

export function requireApiHq(): Session | NextResponse {
  const session = requireApiSession();
  if (session instanceof NextResponse) return session;
  if (session.mustChange) {
    return NextResponse.json(
      { error: "パスワード変更が必要です" },
      { status: 403 }
    );
  }
  if (session.role !== "hq") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  return session;
}
