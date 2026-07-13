import type {
	Announcement,
	Comment,
	DailyMetrics,
	DashboardData,
	GasStoreRow,
	HygieneStatus,
	Store,
	UiSettings,
} from "./types";
import { DEFAULT_UI_SETTINGS } from "./types";
import type { DataProvider, StoreOverviewRow } from "./data";

const TOTAL_STORES = 42;

const stores: Store[] = [
	{ id: "s1", code: "101", name: "福島栄町店", brand: "鶏ヤロー・まる助", active: true },
	{ id: "s2", code: "102", name: "郡山駅前店", brand: "鶏ヤロー", active: true },
	{ id: "s3", code: "103", name: "いわき平店", brand: "鶏ヤロー", active: true },
	{ id: "s4", code: "104", name: "仙台国分町店", brand: "まる助", active: true },
	{ id: "s5", code: "105", name: "宇都宮東口店", brand: "鶏ヤロー", active: true },
	{ id: "s6", code: "106", name: "大宮南銀座店", brand: "まる助", active: true },
	{ id: "s7", code: "107", name: "川越クレアモール店", brand: "イザカラ", active: true },
	{ id: "s8", code: "108", name: "上野御徒町店", brand: "すし鳥酒場", active: true },
];

function dateStr(daysAgo: number): string {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

// 福島栄町店(モックアップ再現)の直近 7 日の総合順位
const HERO_RANKS = [26, 18, 15, 13, 13, 10, 3];
const HERO_KPI = [3.63, 3.84, 3.95, 4.02, 4.06, 4.21, 4.32]; // KPI は 5 点満点

function heroMetrics(daysAgo: number): DailyMetrics {
	const i = 6 - daysAgo;
	return {
		storeId: "s1",
		date: dateStr(daysAgo),
		kpiScore: HERO_KPI[i],
		kpiAvg: 3.91,
		kpiRank: HERO_RANKS[i],
		overallRank: HERO_RANKS[i],
		totalStores: TOTAL_STORES,
		costRate: 28.7,
		costRateRank: 8,
		costRateTarget: 30.0,
		costRateAvg: 29.3,
		laborRate: 24.1,
		laborRateRank: 11,
		laborRateTarget: 25.0,
		laborRateAvg: 24.8,
		qscScore: 89.2,
		qscRank: 4,
		qscPrevRank: 5,
		qscAnswers: 12,
		qscQuestions: [
			{ label: "Q1. お食事の満足度", score: 93 },
			{ label: "Q2. 欠品で注文できないメニュー", score: 100 },
			{ label: "Q3. スタッフの態度", score: 97 },
			{ label: "Q4. 入店時の対応", score: 90 },
			{ label: "Q5. レジ周りの整理整頓", score: 85 },
			{ label: "Q6. 店内の清潔感", score: 92.5 },
			{ label: "Q7. 客席のベタつき", score: 80 },
			{ label: "Q8. 食器類の汚れ", score: 95 },
			{ label: "Q9. トイレの清潔感", score: 77.5 },
			{ label: "Q10. スタッフの身だしなみ", score: 90 },
		],
		updatedAt: new Date().toISOString(),
	};
}

// 他店舗向けの簡易な擬似データ(店舗インデックスで決定的に生成)
function genMetrics(store: Store, index: number, daysAgo: number): DailyMetrics {
	const base = 3.2 + ((index * 7) % 20) / 20;
	const kpi = Math.round((base + (6 - daysAgo) * 0.04) * 100) / 100;
	const rank = ((index * 5 + daysAgo * 3) % TOTAL_STORES) + 1;
	return {
		storeId: store.id,
		date: dateStr(daysAgo),
		kpiScore: kpi,
		kpiAvg: 3.91,
		kpiRank: rank,
		overallRank: rank,
		totalStores: TOTAL_STORES,
		costRate: Math.round((28 + (index % 5)) * 10) / 10,
		costRateRank: ((index * 3) % TOTAL_STORES) + 1,
		costRateTarget: 30.0,
		costRateAvg: 29.3,
		laborRate: Math.round((23 + (index % 4)) * 10) / 10,
		laborRateRank: ((index * 4) % TOTAL_STORES) + 1,
		laborRateTarget: 25.0,
		laborRateAvg: 24.8,
		qscScore: Math.round((80 + (index * 3) % 15) * 10) / 10,
		qscRank: ((index * 6) % TOTAL_STORES) + 1,
		qscPrevRank: ((index * 6 + 2) % TOTAL_STORES) + 1,
		qscAnswers: null,
		qscQuestions: null,
		updatedAt: new Date().toISOString(),
	};
}

const metricsByStore = new Map<string, DailyMetrics[]>(
	stores.map((s, idx) => [
		s.id,
		Array.from({ length: 7 }, (_, i) => {
			const daysAgo = 6 - i;
			return s.id === "s1" ? heroMetrics(daysAgo) : genMetrics(s, idx + 1, daysAgo);
		}),
	]),
);

const hygieneByStore = new Map<string, HygieneStatus>(
	stores.map((s, idx) => [
		s.id,
		{
			storeId: s.id,
			date: dateStr(0),
			dailySubmitted: s.id === "s1" ? 6 : (idx * 2) % 8,
			dailyRequired: 7,
			weeklySubmitted: s.id === "s1" ? 5 : (idx * 3) % 8,
			weeklyRequired: 7,
			lastSubmittedAt: new Date().toISOString(),
		},
	]),
);

let commentSeq = 4;
const comments: Comment[] = [
	{
		id: "c1",
		storeId: "s1",
		authorName: "田中",
		authorRole: "am",
		body: "厨房の清掃が行き届いており、素晴らしいです。この調子で継続しましょう!",
		createdAt: new Date(Date.now() - 4 * 3600_000).toISOString(),
	},
	{
		id: "c2",
		storeId: "s1",
		authorName: "佐藤",
		authorRole: "sv",
		body: "ドリンク機器の周辺清掃をさらに強化しましょう。",
		createdAt: new Date(Date.now() - 10 * 3600_000).toISOString(),
	},
	{
		id: "c3",
		storeId: null,
		authorName: "衛生管理チーム",
		authorRole: "hq",
		body: "週次チェックの提出は、期限内の提出をお願いします。",
		createdAt: new Date(Date.now() - 37 * 3600_000).toISOString(),
	},
];

let uiSettings: UiSettings = structuredClone(DEFAULT_UI_SETTINGS);

let announcementSeq = 2;
const announcements: Announcement[] = [
	{
		id: "a1",
		title: "夏季の衛生強化キャンペーンを開始しました。",
		linkUrl: "#",
		publishedAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
	},
];

export const mockProvider: DataProvider = {
	isMock: true,

	async verifyStoreLogin(code, password) {
		if (password !== "demo") return null;
		return stores.find((s) => s.code === code && s.active) ?? null;
	},

	async getStoreByCode(code) {
		return stores.find((s) => s.code === code) ?? null;
	},

	async listStores() {
		return stores;
	},

	async getDashboard(store): Promise<DashboardData> {
		const history = metricsByStore.get(store.id) ?? [];
		const today = history[history.length - 1] ?? null;
		const yesterday = history[history.length - 2] ?? null;
		// 月次順位(デモ用: 12ヶ月かけて順位が上がっていく)
		const heroMonthly = [31, 28, 26, 22, 19, 15, 14, 12, 10, 8, 5, 3];
		const monthlyRankHistory = Array.from({ length: 12 }, (_, i) => {
			const d = new Date();
			d.setMonth(d.getMonth() - (11 - i), 1);
			const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
			const idx = Number(store.id.replace("s", "")) || 1;
			const rank =
				store.id === "s1" ? heroMonthly[i] : ((idx * 7 + (11 - i) * 3) % TOTAL_STORES) + 1;
			return { date: month, rank };
		});
		return {
			store,
			today,
			yesterday,
			history,
			rankHistory: history.map((m) => ({ date: m.date, rank: m.overallRank })),
			monthlyRankHistory,
			hygiene: hygieneByStore.get(store.id) ?? null,
			comments: comments
				.filter((c) => c.storeId === store.id || c.storeId === null)
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.slice(0, 3),
			latestAnnouncement: announcements[0] ?? null,
		};
	},

	async listStoreOverview(): Promise<StoreOverviewRow[]> {
		return stores.map((s) => {
			const history = metricsByStore.get(s.id) ?? [];
			return {
				store: s,
				today: history[history.length - 1] ?? null,
				hygiene: hygieneByStore.get(s.id) ?? null,
			};
		});
	},

	async listAnnouncements() {
		return [...announcements].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
	},

	async createAnnouncement(input) {
		announcements.unshift({
			id: `a${announcementSeq++}`,
			title: input.title,
			linkUrl: input.linkUrl ?? null,
			publishedAt: new Date().toISOString(),
		});
	},

	async deleteAnnouncement(id) {
		const i = announcements.findIndex((a) => a.id === id);
		if (i >= 0) announcements.splice(i, 1);
	},

	async listComments(limit) {
		return [...comments]
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			.slice(0, limit)
			.map((c) => ({
				...c,
				storeName: c.storeId ? stores.find((s) => s.id === c.storeId)?.name ?? null : null,
			}));
	},

	async createComment(input) {
		comments.unshift({
			id: `c${commentSeq++}`,
			storeId: input.storeId,
			authorName: input.authorName,
			authorRole: input.authorRole,
			body: input.body,
			createdAt: new Date().toISOString(),
		});
	},

	async deleteComment(id) {
		const i = comments.findIndex((c) => c.id === id);
		if (i >= 0) comments.splice(i, 1);
	},

	async upsertDailyMetrics(date, totalStores, rows: GasStoreRow[]) {
		const unknownCodes: string[] = [];
		let updated = 0;
		for (const row of rows) {
			const store = stores.find((s) => s.code === row.code);
			if (!store) {
				unknownCodes.push(row.code);
				continue;
			}
			const history = metricsByStore.get(store.id) ?? [];
			const next: DailyMetrics = {
				storeId: store.id,
				date,
				kpiScore: row.kpi_score,
				kpiAvg: row.kpi_avg ?? null,
				kpiRank: row.kpi_rank ?? null,
				overallRank: row.overall_rank,
				totalStores,
				costRate: row.cost_rate,
				costRateRank: row.cost_rate_rank ?? null,
				costRateTarget: row.cost_rate_target ?? null,
				costRateAvg: row.cost_rate_avg ?? null,
				laborRate: row.labor_rate,
				laborRateRank: row.labor_rate_rank ?? null,
				laborRateTarget: row.labor_rate_target ?? null,
				laborRateAvg: row.labor_rate_avg ?? null,
				qscScore: row.qsc_score ?? null,
				qscRank: row.qsc_rank ?? null,
				qscPrevRank: row.qsc_prev_rank ?? null,
				qscAnswers: row.qsc_answers ?? null,
				qscQuestions: row.qsc_questions ?? null,
				updatedAt: new Date().toISOString(),
			};
			const idx = history.findIndex((m) => m.date === date);
			if (idx >= 0) history[idx] = next;
			else {
				history.push(next);
				history.sort((a, b) => a.date.localeCompare(b.date));
			}
			metricsByStore.set(store.id, history);
			if (row.hygiene) {
				hygieneByStore.set(store.id, {
					storeId: store.id,
					date,
					dailySubmitted: row.hygiene.daily_submitted,
					dailyRequired: row.hygiene.daily_required ?? 7,
					weeklySubmitted: row.hygiene.weekly_submitted,
					weeklyRequired: row.hygiene.weekly_required ?? 7,
					lastSubmittedAt: row.hygiene.last_submitted_at ?? null,
				});
			}
			updated++;
		}
		return { updated, unknownCodes };
	},

	async getUiSettings() {
		return uiSettings;
	},

	async saveUiSettings(settings) {
		uiSettings = settings;
	},

	async upsertStores(rows) {
		let created = 0;
		let updated = 0;
		const skippedNoPassword: string[] = [];
		for (const row of rows) {
			const existing = stores.find((s) => s.code === row.code);
			if (existing) {
				existing.name = row.name;
				if (row.brand) existing.brand = row.brand;
				if (row.qsc_url !== undefined) existing.qscUrl = row.qsc_url || null;
				updated++;
			} else {
				if (!row.password) {
					skippedNoPassword.push(row.code);
					continue;
				}
				stores.push({
					id: `s${stores.length + 1}`,
					code: row.code,
					name: row.name,
					brand: row.brand ?? "",
					active: true,
				});
				created++;
			}
		}
		return { created, updated, skippedNoPassword };
	},
};
