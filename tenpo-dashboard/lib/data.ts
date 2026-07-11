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
	if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
		const { supabaseProvider } = await import("./supabase");
		provider = supabaseProvider;
	} else {
		const { mockProvider } = await import("./mock");
		provider = mockProvider;
	}
	return provider;
}
