import type {
	Announcement,
	Comment,
	CommentRole,
	DashboardData,
	DailyMetrics,
	GasStoreRow,
	HygieneStatus,
	Store,
} from "./types";

export type StoreOverviewRow = {
	store: Store;
	today: DailyMetrics | null;
	hygiene: HygieneStatus | null;
};

export type CommentWithStore = Comment & { storeName?: string | null };

export interface DataProvider {
	/** true のときはデモデータで動作中(書き込みは再起動で消える) */
	isMock: boolean;
	verifyStoreLogin(code: string, password: string): Promise<Store | null>;
	getStoreByCode(code: string): Promise<Store | null>;
	listStores(): Promise<Store[]>;
	getDashboard(store: Store): Promise<DashboardData>;
	listStoreOverview(): Promise<StoreOverviewRow[]>;
	listAnnouncements(): Promise<Announcement[]>;
	createAnnouncement(input: { title: string; linkUrl?: string | null }): Promise<void>;
	deleteAnnouncement(id: string): Promise<void>;
	listComments(limit: number): Promise<CommentWithStore[]>;
	createComment(input: {
		storeId: string | null;
		authorName: string;
		authorRole: CommentRole;
		body: string;
	}): Promise<void>;
	deleteComment(id: string): Promise<void>;
	upsertDailyMetrics(
		date: string,
		totalStores: number,
		rows: GasStoreRow[],
	): Promise<{ updated: number; unknownCodes: string[] }>;
}

let provider: DataProvider | null = null;

export async function getProvider(): Promise<DataProvider> {
	if (provider) return provider;
	const hasFirebase =
		!!process.env.FIREBASE_SERVICE_ACCOUNT ||
		!!(
			process.env.FIREBASE_PROJECT_ID &&
			process.env.FIREBASE_CLIENT_EMAIL &&
			process.env.FIREBASE_PRIVATE_KEY
		) ||
		!!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
		// Firebase App Hosting / Cloud Run 上では自動的に設定される
		!!process.env.FIREBASE_CONFIG ||
		!!process.env.GOOGLE_CLOUD_PROJECT;
	if (hasFirebase) {
		const { firebaseProvider } = await import("./firebase");
		provider = firebaseProvider;
	} else {
		const { mockProvider } = await import("./mock");
		provider = mockProvider;
	}
	return provider;
}
