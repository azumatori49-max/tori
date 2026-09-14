import { NextResponse } from "next/server";
import { requireApiHq } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { rollbackImport } from "@/lib/imports";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = requireApiHq();
  if (session instanceof NextResponse) return session;

  const db = await getDb();
  const result = await rollbackImport(db, params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
