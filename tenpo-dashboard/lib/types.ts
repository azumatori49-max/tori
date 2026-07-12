export type Store = {
	id: string;
	code: string;
	name: string;
	brand: string;
	active: boolean;
	/** andy などアンケートの詳細ページ URL(店舗別) */
	qscUrl?: string | null;
};

export type DailyMetrics = {
	storeId: string;
	date: string; // YYYY-MM-DD
	kpiScore: number;
	kpiAvg: number | null;
	kpiRank: number | null;
	overallRank: number;
	totalStores: number;
	costRate: number;
	costRateRank: number | null;
	costRateTarget: number | null;
	costRateAvg: number | null;
	laborRate: number;
	laborRateRank: number | null;
	laborRateTarget: number | null;
	laborRateAvg: number | null;
	qscScore: number | null;
	qscRank: number | null;
	qscPrevRank: number | null;
	qscAnswers: number | null;
	qscQuestions: { label: string; score: number | null }[] | null;
	updatedAt: string;
};

export type HygieneStatus = {
	storeId: string;
	date: string;
	dailySubmitted: number;
	dailyRequired: number;
	weeklySubmitted: number;
	weeklyRequired: number;
	lastSubmittedAt: string | null;
};

export type CommentRole = "am" | "sv" | "hq";

export type Comment = {
	id: string;
	storeId: string | null; // null = 全店舗宛て
	authorName: string;
	authorRole: CommentRole;
	body: string;
	createdAt: string;
};

export type Announcement = {
	id: string;
	title: string;
	linkUrl: string | null;
	publishedAt: string;
};

export type RankPoint = {
	date: string;
	rank: number;
};

export type DashboardData = {
	store: Store;
	today: DailyMetrics | null;
	yesterday: DailyMetrics | null;
	/** 日付昇順の履歴(詳細ページの推移グラフに使用) */
	history: DailyMetrics[];
	rankHistory: RankPoint[];
	hygiene: HygieneStatus | null;
	comments: Comment[];
	latestAnnouncement: Announcement | null;
};

export const ROLE_LABELS: Record<CommentRole, string> = {
	am: "エリアマネージャー",
	sv: "スーパーバイザー",
	hq: "本部 衛生管理チーム",
};

/** GAS 同期 API が受け取る 1 店舗分のペイロード */
export type GasStoreRow = {
	code: string;
	kpi_score: number;
	kpi_avg?: number;
	kpi_rank?: number;
	overall_rank: number;
	cost_rate: number;
	cost_rate_rank?: number;
	cost_rate_target?: number;
	cost_rate_avg?: number;
	labor_rate: number;
	labor_rate_rank?: number;
	labor_rate_target?: number;
	labor_rate_avg?: number;
	qsc_score?: number;
	qsc_rank?: number;
	qsc_prev_rank?: number;
	qsc_answers?: number;
	qsc_questions?: { label: string; score: number | null }[];
	hygiene?: {
		daily_submitted: number;
		daily_required?: number;
		weekly_submitted: number;
		weekly_required?: number;
		last_submitted_at?: string;
	};
};

export type GasSyncPayload = {
	date: string; // YYYY-MM-DD
	total_stores: number;
	stores: GasStoreRow[];
};

/** 店舗登録 API(/api/gas/stores)が受け取る 1 店舗分のペイロード */
export type GasStoreUpsertRow = {
	code: string;
	name: string;
	brand?: string;
	password?: string; // 新規店舗は必須。既存店舗は指定時のみ変更
	qsc_url?: string; // アンケート詳細ページの URL(指定時のみ更新)
};
