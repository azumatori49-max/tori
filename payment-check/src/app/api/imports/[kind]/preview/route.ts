import { NextResponse } from "next/server";
import { requireApiHq } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildPreview, type Mapping } from "@/lib/imports";

export async function POST(
  req: Request,
  { params }: { params: { kind: string } }
) {
  const session = requireApiHq();
  if (session instanceof NextResponse) return session;

  const kind = params.kind as "mf" | "pos";
  if (kind !== "mf" && kind !== "pos") {
    return NextResponse.json({ error: "不正な種別です" }, { status: 400 });
  }

  const body = (await req.json()) as {
    text: string;
    mapping?: Mapping | null;
    overwrite?: boolean;
    assignments?: Record<string, string>;
  };
  const db = await getDb();
  const preview = await buildPreview(
    db,
    kind,
    body.text ?? "",
    body.mapping ?? null,
    !!body.overwrite,
    body.assignments ?? {}
  );
  return NextResponse.json(preview);
}
