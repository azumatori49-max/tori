import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/data";
import type { GasStoreUpsertRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
	const secret = process.env.GAS_SYNC_SECRET;
	if (!secret) return false; // シークレット未設定時は API を無効化
	const provided = req.headers.get("x-api-key") ?? "";
	const a = Buffer.from(provided);
	const b = Buffer.from(secret);
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
	if (!authorized(req)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	let payload: { stores?: GasStoreUpsertRow[] };
	try {
		payload = await req.json();
	} catch {
		return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
	}

	if (!payload || !Array.isArray(payload.stores) || payload.stores.length === 0) {
		return NextResponse.json({ error: "stores[] is required" }, { status: 400 });
	}
	for (const row of payload.stores) {
		if (typeof row.code !== "string" || !row.code.trim() || typeof row.name !== "string" || !row.name.trim()) {
			return NextResponse.json(
				{ error: `店舗コードと店舗名は必須です (code=${String(row?.code)})` },
				{ status: 400 },
			);
		}
	}

	try {
		const provider = await getProvider();
		const result = await provider.upsertStores(
			payload.stores.map((r) => ({
				code: r.code.trim(),
				name: r.name.trim(),
				brand: r.brand?.trim() || undefined,
				password: r.password?.trim() || undefined,
			})),
		);
		return NextResponse.json({ ok: true, ...result });
	} catch (e) {
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : "internal error" },
			{ status: 500 },
		);
	}
}
