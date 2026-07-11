import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyPassword } from "./auth";
import type { DataProvider, StoreOverviewRow } from "./data";
import type {
	Announcement,
	Comment,
	DailyMetrics,
	DashboardData,
	HygieneStatus,
	Store,
} from "./types";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
	if (!client) {
		client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
			auth: { persistSession: false },
		});
	}
	return client;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapStore(row: any): Store {
	return { id: row.id, code: row.code, name: row.name, brand: row.brand ?? "", active: row.active };
}

function mapMetrics(row: any): DailyMetrics {
	return {
		storeId: row.store_id,
		date: row.date,
		kpiScore: Number(row.kpi_score),
		kpiAvg: row.kpi_avg === null ? null : Number(row.kpi_avg),
		overallRank: row.overall_rank,
		totalStores: row.total_stores,
		costRate: Number(row.cost_rate),
		costRateRank: row.cost_rate_rank,
		costRateTarget: row.cost_rate_target === null ? null : Number(row.cost_rate_target),
		costRateAvg: row.cost_rate_avg === null ? null : Number(row.cost_rate_avg),
		laborRate: Number(row.labor_rate),
		laborRateRank: row.labor_rate_rank,
		laborRateTarget: row.labor_rate_target === null ? null : Number(row.labor_rate_target),
		laborRateAvg: row.labor_rate_avg === null ? null : Number(row.labor_rate_avg),
		qscScore: row.qsc_score === null ? null : Number(row.qsc_score),
		qscRank: row.qsc_rank,
		qscPrevRank: row.qsc_prev_rank,
		updatedAt: row.updated_at,
	};
}

function mapHygiene(row: any): HygieneStatus {
	return {
		storeId: row.store_id,
		date: row.date,
		dailySubmitted: row.daily_submitted,
		dailyRequired: row.daily_required,
		weeklySubmitted: row.weekly_submitted,
		weeklyRequired: row.weekly_required,
		lastSubmittedAt: row.last_submitted_at,
	};
}

function mapComment(row: any): Comment {
	return {
		id: row.id,
		storeId: row.store_id,
		authorName: row.author_name,
		authorRole: row.author_role,
		body: row.body,
		createdAt: row.created_at,
	};
}

function mapAnnouncement(row: any): Announcement {
	return { id: row.id, title: row.title, linkUrl: row.link_url, publishedAt: row.published_at };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const supabaseProvider: DataProvider = {
	isMock: false,

	async verifyStoreLogin(code, password) {
		const { data } = await db()
			.from("stores")
			.select("*")
			.eq("code", code)
			.eq("active", true)
			.maybeSingle();
		if (!data?.password_hash) return null;
		if (!verifyPassword(password, data.password_hash)) return null;
		return mapStore(data);
	},

	async getStoreByCode(code) {
		const { data } = await db().from("stores").select("*").eq("code", code).maybeSingle();
		return data ? mapStore(data) : null;
	},

	async listStores() {
		const { data } = await db().from("stores").select("*").eq("active", true).order("code");
		return (data ?? []).map(mapStore);
	},

	async getDashboard(store): Promise<DashboardData> {
		const [metricsRes, hygieneRes, commentsRes, annRes] = await Promise.all([
			db()
				.from("daily_metrics")
				.select("*")
				.eq("store_id", store.id)
				.order("date", { ascending: false })
				.limit(7),
			db()
				.from("hygiene_status")
				.select("*")
				.eq("store_id", store.id)
				.maybeSingle(),
			db()
				.from("comments")
				.select("*")
				.or(`store_id.eq.${store.id},store_id.is.null`)
				.order("created_at", { ascending: false })
				.limit(3),
			db()
				.from("announcements")
				.select("*")
				.order("published_at", { ascending: false })
				.limit(1),
		]);
		const history = (metricsRes.data ?? []).map(mapMetrics).reverse();
		return {
			store,
			today: history[history.length - 1] ?? null,
			yesterday: history[history.length - 2] ?? null,
			rankHistory: history.map((m) => ({ date: m.date, rank: m.overallRank })),
			hygiene: hygieneRes.data ? mapHygiene(hygieneRes.data) : null,
			comments: (commentsRes.data ?? []).map(mapComment),
			latestAnnouncement: annRes.data?.[0] ? mapAnnouncement(annRes.data[0]) : null,
		};
	},

	async listStoreOverview(): Promise<StoreOverviewRow[]> {
		const stores = await this.listStores();
		if (stores.length === 0) return [];
		const [metricsRes, hygieneRes] = await Promise.all([
			db()
				.from("daily_metrics")
				.select("*")
				.in("store_id", stores.map((s) => s.id))
				.order("date", { ascending: false }),
			db()
				.from("hygiene_status")
				.select("*")
				.in("store_id", stores.map((s) => s.id)),
		]);
		const latestByStore = new Map<string, DailyMetrics>();
		for (const row of metricsRes.data ?? []) {
			if (!latestByStore.has(row.store_id)) latestByStore.set(row.store_id, mapMetrics(row));
		}
		const hygieneByStore = new Map<string, HygieneStatus>(
			(hygieneRes.data ?? []).map((row) => [row.store_id, mapHygiene(row)]),
		);
		return stores.map((store) => ({
			store,
			today: latestByStore.get(store.id) ?? null,
			hygiene: hygieneByStore.get(store.id) ?? null,
		}));
	},

	async listAnnouncements() {
		const { data } = await db()
			.from("announcements")
			.select("*")
			.order("published_at", { ascending: false })
			.limit(50);
		return (data ?? []).map(mapAnnouncement);
	},

	async createAnnouncement(input) {
		await db().from("announcements").insert({ title: input.title, link_url: input.linkUrl ?? null });
	},

	async deleteAnnouncement(id) {
		await db().from("announcements").delete().eq("id", id);
	},

	async listComments(limit) {
		const { data } = await db()
			.from("comments")
			.select("*, stores(name)")
			.order("created_at", { ascending: false })
			.limit(limit);
		return (data ?? []).map((row) => ({
			...mapComment(row),
			storeName: row.stores?.name ?? null,
		}));
	},

	async createComment(input) {
		await db().from("comments").insert({
			store_id: input.storeId,
			author_name: input.authorName,
			author_role: input.authorRole,
			body: input.body,
		});
	},

	async deleteComment(id) {
		await db().from("comments").delete().eq("id", id);
	},

	async upsertDailyMetrics(date, totalStores, rows) {
		const codes = rows.map((r) => r.code);
		const { data: storeRows } = await db().from("stores").select("id, code").in("code", codes);
		const idByCode = new Map<string, string>((storeRows ?? []).map((s) => [s.code, s.id]));
		const unknownCodes = codes.filter((c) => !idByCode.has(c));

		const metricRows = rows
			.filter((r) => idByCode.has(r.code))
			.map((r) => ({
				store_id: idByCode.get(r.code)!,
				date,
				kpi_score: r.kpi_score,
				kpi_avg: r.kpi_avg ?? null,
				overall_rank: r.overall_rank,
				total_stores: totalStores,
				cost_rate: r.cost_rate,
				cost_rate_rank: r.cost_rate_rank ?? null,
				cost_rate_target: r.cost_rate_target ?? null,
				cost_rate_avg: r.cost_rate_avg ?? null,
				labor_rate: r.labor_rate,
				labor_rate_rank: r.labor_rate_rank ?? null,
				labor_rate_target: r.labor_rate_target ?? null,
				labor_rate_avg: r.labor_rate_avg ?? null,
				qsc_score: r.qsc_score ?? null,
				qsc_rank: r.qsc_rank ?? null,
				qsc_prev_rank: r.qsc_prev_rank ?? null,
				updated_at: new Date().toISOString(),
			}));
		if (metricRows.length > 0) {
			const { error } = await db()
				.from("daily_metrics")
				.upsert(metricRows, { onConflict: "store_id,date" });
			if (error) throw new Error(`daily_metrics upsert failed: ${error.message}`);
		}

		const hygieneRows = rows
			.filter((r) => r.hygiene && idByCode.has(r.code))
			.map((r) => ({
				store_id: idByCode.get(r.code)!,
				date,
				daily_submitted: r.hygiene!.daily_submitted,
				daily_required: r.hygiene!.daily_required ?? 7,
				weekly_submitted: r.hygiene!.weekly_submitted,
				weekly_required: r.hygiene!.weekly_required ?? 7,
				last_submitted_at: r.hygiene!.last_submitted_at ?? null,
			}));
		if (hygieneRows.length > 0) {
			const { error } = await db()
				.from("hygiene_status")
				.upsert(hygieneRows, { onConflict: "store_id" });
			if (error) throw new Error(`hygiene_status upsert failed: ${error.message}`);
		}

		return { updated: metricRows.length, unknownCodes };
	},
};
