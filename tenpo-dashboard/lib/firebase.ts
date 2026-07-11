import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { hashPassword, verifyPassword } from "./auth";
import type { DataProvider, StoreOverviewRow } from "./data";
import type {
	Announcement,
	Comment,
	DailyMetrics,
	DashboardData,
	GasStoreRow,
	HygieneStatus,
	Store,
} from "./types";

function app(): App {
	const existing = getApps();
	if (existing.length > 0) return existing[0];

	// 1) FIREBASE_SERVICE_ACCOUNT: サービスアカウント JSON をそのまま入れる
	const json = process.env.FIREBASE_SERVICE_ACCOUNT;
	if (json) {
		return initializeApp({ credential: cert(JSON.parse(json)) });
	}
	// 2) 個別の環境変数で指定
	if (
		process.env.FIREBASE_PROJECT_ID &&
		process.env.FIREBASE_CLIENT_EMAIL &&
		process.env.FIREBASE_PRIVATE_KEY
	) {
		return initializeApp({
			credential: cert({
				projectId: process.env.FIREBASE_PROJECT_ID,
				clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
				privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
			}),
		});
	}
	// 3) GOOGLE_APPLICATION_CREDENTIALS / Firebase App Hosting・Cloud Run 上の既定認証
	return initializeApp({ credential: applicationDefault() });
}

function db(): Firestore {
	return getFirestore(app());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapStore(id: string, data: any): Store {
	return {
		id,
		code: data.code,
		name: data.name,
		brand: data.brand ?? "",
		active: data.active !== false,
	};
}

function mapMetrics(storeId: string, data: any): DailyMetrics {
	return {
		storeId,
		date: data.date,
		kpiScore: data.kpiScore,
		kpiAvg: data.kpiAvg ?? null,
		kpiRank: data.kpiRank ?? null,
		overallRank: data.overallRank,
		totalStores: data.totalStores,
		costRate: data.costRate,
		costRateRank: data.costRateRank ?? null,
		costRateTarget: data.costRateTarget ?? null,
		costRateAvg: data.costRateAvg ?? null,
		laborRate: data.laborRate,
		laborRateRank: data.laborRateRank ?? null,
		laborRateTarget: data.laborRateTarget ?? null,
		laborRateAvg: data.laborRateAvg ?? null,
		qscScore: data.qscScore ?? null,
		qscRank: data.qscRank ?? null,
		qscPrevRank: data.qscPrevRank ?? null,
		updatedAt: data.updatedAt,
	};
}

function mapHygiene(storeId: string, data: any): HygieneStatus {
	return {
		storeId,
		date: data.date,
		dailySubmitted: data.dailySubmitted ?? 0,
		dailyRequired: data.dailyRequired ?? 7,
		weeklySubmitted: data.weeklySubmitted ?? 0,
		weeklyRequired: data.weeklyRequired ?? 7,
		lastSubmittedAt: data.lastSubmittedAt ?? null,
	};
}

function mapComment(id: string, data: any): Comment {
	return {
		id,
		storeId: data.storeId ?? null,
		authorName: data.authorName,
		authorRole: data.authorRole,
		body: data.body,
		createdAt: data.createdAt,
	};
}

function mapAnnouncement(id: string, data: any): Announcement {
	return {
		id,
		title: data.title,
		linkUrl: data.linkUrl ?? null,
		publishedAt: data.publishedAt,
	};
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function findStoreDocByCode(code: string) {
	const snap = await db().collection("stores").where("code", "==", code).limit(1).get();
	return snap.empty ? null : snap.docs[0];
}

export const firebaseProvider: DataProvider = {
	isMock: false,

	async verifyStoreLogin(code, password) {
		const doc = await findStoreDocByCode(code);
		if (!doc) return null;
		const data = doc.data();
		if (data.active === false || !data.passwordHash) return null;
		if (!verifyPassword(password, data.passwordHash)) return null;
		return mapStore(doc.id, data);
	},

	async getStoreByCode(code) {
		const doc = await findStoreDocByCode(code);
		return doc ? mapStore(doc.id, doc.data()) : null;
	},

	async listStores() {
		const snap = await db().collection("stores").get();
		return snap.docs
			.map((d) => mapStore(d.id, d.data()))
			.filter((s) => s.active)
			.sort((a, b) => a.code.localeCompare(b.code));
	},

	async getDashboard(store): Promise<DashboardData> {
		const storeRef = db().collection("stores").doc(store.id);
		const [metricsSnap, storeSnap, commentsSnap, annSnap] = await Promise.all([
			storeRef.collection("metrics").orderBy("date", "desc").limit(7).get(),
			storeRef.get(),
			db().collection("comments").orderBy("createdAt", "desc").limit(50).get(),
			db().collection("announcements").orderBy("publishedAt", "desc").limit(1).get(),
		]);
		const history = metricsSnap.docs.map((d) => mapMetrics(store.id, d.data())).reverse();
		const hygieneData = storeSnap.data()?.hygiene;
		const comments = commentsSnap.docs
			.map((d) => mapComment(d.id, d.data()))
			.filter((c) => c.storeId === store.id || c.storeId === null)
			.slice(0, 3);
		return {
			store,
			today: history[history.length - 1] ?? null,
			yesterday: history[history.length - 2] ?? null,
			rankHistory: history.map((m) => ({ date: m.date, rank: m.overallRank })),
			hygiene: hygieneData ? mapHygiene(store.id, hygieneData) : null,
			comments,
			latestAnnouncement: annSnap.empty
				? null
				: mapAnnouncement(annSnap.docs[0].id, annSnap.docs[0].data()),
		};
	},

	async listStoreOverview(): Promise<StoreOverviewRow[]> {
		const snap = await db().collection("stores").get();
		return snap.docs
			.filter((d) => d.data().active !== false)
			.map((d) => {
				const data = d.data();
				return {
					store: mapStore(d.id, data),
					today: data.latestMetrics ? mapMetrics(d.id, data.latestMetrics) : null,
					hygiene: data.hygiene ? mapHygiene(d.id, data.hygiene) : null,
				};
			})
			.sort((a, b) => a.store.code.localeCompare(b.store.code));
	},

	async listAnnouncements() {
		const snap = await db()
			.collection("announcements")
			.orderBy("publishedAt", "desc")
			.limit(50)
			.get();
		return snap.docs.map((d) => mapAnnouncement(d.id, d.data()));
	},

	async createAnnouncement(input) {
		await db().collection("announcements").add({
			title: input.title,
			linkUrl: input.linkUrl ?? null,
			publishedAt: new Date().toISOString(),
		});
	},

	async deleteAnnouncement(id) {
		await db().collection("announcements").doc(id).delete();
	},

	async listComments(limit) {
		const [commentsSnap, stores] = await Promise.all([
			db().collection("comments").orderBy("createdAt", "desc").limit(limit).get(),
			this.listStores(),
		]);
		const nameById = new Map(stores.map((s) => [s.id, s.name]));
		return commentsSnap.docs.map((d) => {
			const c = mapComment(d.id, d.data());
			return { ...c, storeName: c.storeId ? nameById.get(c.storeId) ?? null : null };
		});
	},

	async createComment(input) {
		await db().collection("comments").add({
			storeId: input.storeId,
			authorName: input.authorName,
			authorRole: input.authorRole,
			body: input.body,
			createdAt: new Date().toISOString(),
		});
	},

	async deleteComment(id) {
		await db().collection("comments").doc(id).delete();
	},

	async upsertDailyMetrics(date, totalStores, rows: GasStoreRow[]) {
		const storesSnap = await db().collection("stores").get();
		const idByCode = new Map<string, string>(
			storesSnap.docs.map((d) => [d.data().code as string, d.id]),
		);
		const unknownCodes: string[] = [];
		let updated = 0;

		// Firestore のバッチは 500 操作まで(1 店舗 = 2 操作)なので分割する
		const known = rows.filter((r) => {
			if (idByCode.has(r.code)) return true;
			unknownCodes.push(r.code);
			return false;
		});
		const CHUNK = 200;
		for (let i = 0; i < known.length; i += CHUNK) {
			const batch = db().batch();
			for (const row of known.slice(i, i + CHUNK)) {
				const storeId = idByCode.get(row.code)!;
				const storeRef = db().collection("stores").doc(storeId);
				const metrics = {
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
					updatedAt: new Date().toISOString(),
				};
				batch.set(storeRef.collection("metrics").doc(date), metrics);
				const storeUpdate: Record<string, unknown> = { latestMetrics: metrics };
				if (row.hygiene) {
					storeUpdate.hygiene = {
						date,
						dailySubmitted: row.hygiene.daily_submitted,
						dailyRequired: row.hygiene.daily_required ?? 7,
						weeklySubmitted: row.hygiene.weekly_submitted,
						weeklyRequired: row.hygiene.weekly_required ?? 7,
						lastSubmittedAt: row.hygiene.last_submitted_at ?? null,
					};
				}
				batch.set(storeRef, storeUpdate, { merge: true });
				updated++;
			}
			await batch.commit();
		}

		return { updated, unknownCodes };
	},

	async upsertStores(rows) {
		const snap = await db().collection("stores").get();
		const docByCode = new Map(snap.docs.map((d) => [d.data().code as string, d]));
		let created = 0;
		let updated = 0;
		const skippedNoPassword: string[] = [];
		for (const row of rows) {
			const existing = docByCode.get(row.code);
			if (existing) {
				const update: Record<string, unknown> = {
					name: row.name,
					brand: row.brand ?? existing.data().brand ?? "",
					active: true,
				};
				if (row.password) update.passwordHash = hashPassword(row.password);
				await existing.ref.set(update, { merge: true });
				updated++;
			} else {
				if (!row.password) {
					skippedNoPassword.push(row.code);
					continue;
				}
				await db().collection("stores").add({
					code: row.code,
					name: row.name,
					brand: row.brand ?? "",
					passwordHash: hashPassword(row.password),
					active: true,
				});
				created++;
			}
		}
		return { created, updated, skippedNoPassword };
	},
};
