import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/data";
import type { GasSyncPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
	const secret = process.env.GAS_SYNC_SECRET;
	if (!secret) return false; // シークレット未設定時は同期 API を無効化
	const provided = req.headers.get("x-api-key") ?? "";
	const a = Buffer.from(provided);
	const b = Buffer.from(secret);
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
	if (!authorized(req)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	let payload: GasSyncPayload;
	try {
		payload = await req.json();
	} catch {
		return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
	}

	if (
		!payload ||
		typeof payload.date !== "string" ||
		!/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
		typeof payload.total_stores !== "number" ||
		!Array.isArray(payload.stores)
	) {
		return NextResponse.json(
			{ error: "date (YYYY-MM-DD), total_stores, stores[] are required" },
			{ status: 400 },
		);
	}

	for (const row of payload.stores) {
		if (
			typeof row.code !== "string" ||
			typeof row.kpi_score !== "number" ||
			typeof row.overall_rank !== "number" ||
			typeof row.cost_rate !== "number" ||
			typeof row.labor_rate !== "number"
		) {
			return NextResponse.json(
				{ error: `invalid row for code=${String(row?.code)}` },
				{ status: 400 },
			);
		}
	}

	// 人件費予算のサニタイズ(任意項目。diff のみ必須)
	for (const row of payload.stores) {
		if (row.labor_budget !== undefined) {
			const lb = row.labor_budget;
			if (!lb || typeof lb.diff !== "number") {
				delete row.labor_budget;
				continue;
			}
			const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
			lb.diff_hours = num(lb.diff_hours);
			lb.budget = num(lb.budget);
			lb.labor_cost = num(lb.labor_cost);
			lb.sales = num(lb.sales);
		}
	}

	// QSC 設問詳細のサニタイズ(任意項目)
	for (const row of payload.stores) {
		if (row.qsc_questions !== undefined) {
			if (!Array.isArray(row.qsc_questions)) {
				delete row.qsc_questions;
				continue;
			}
			row.qsc_questions = row.qsc_questions
				.slice(0, 20)
				.filter((q) => q && typeof q.label === "string")
				.map((q) => ({
					label: q.label.slice(0, 100),
					score: typeof q.score === "number" ? q.score : null,
				}));
		}
	}

	try {
		const provider = await getProvider();
		const result = await provider.upsertDailyMetrics(
			payload.date,
			payload.total_stores,
			payload.stores,
		);
		return NextResponse.json({ ok: true, ...result });
	} catch (e) {
		return NextResponse.json(
			{ error: e instanceof Error ? e.message : "internal error" },
			{ status: 500 },
		);
	}
}
