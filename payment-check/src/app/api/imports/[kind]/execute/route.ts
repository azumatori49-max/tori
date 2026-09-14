import { NextResponse } from "next/server";
import { requireApiHq } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildPreview, executeImport, type Mapping } from "@/lib/imports";

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
    fileName: string;
    mapping?: Mapping | null;
    overwrite?: boolean;
    assignments?: Record<string, string>;
  };
  const db = await getDb();
  // サーバー側で再プレビューして確定内容を検証する
  const preview = await buildPreview(
    db,
    kind,
    body.text ?? "",
    body.mapping ?? null,
    !!body.overwrite,
    body.assignments ?? {}
  );
  const result = await executeImport(
    db,
    kind,
    body.fileName || "import.csv",
    preview,
    !!body.overwrite,
    body.assignments ?? {},
    session.uid
  );
  return NextResponse.json(result);
}
