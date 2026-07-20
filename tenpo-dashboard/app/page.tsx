import Link from "next/link";
import { redirect } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import RankChart from "@/components/RankChart";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/data";
import { getLiveHygiene } from "@/lib/hygiene";
import {
	fmt1,
	fmt2,
	fmtDateTime,
	fmtMDFromIso,
	isNew,
	submitState,
} from "@/lib/format";
import type { Comment, DailyMetrics, HygieneStatus, UiSettings } from "@/lib/types";
import { roleLabel } from "@/lib/types";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

function Diff({ value, unit, digits = 1 }: { value: number | null; unit: string; digits?: number }) {
	if (value === null) return <b>-</b>;
	const factor = 10 ** digits;
	const rounded = Math.round(value * factor) / factor;
	if (rounded > 0) return <b className="diff-up">+{rounded.toFixed(digits)}{unit}</b>;
	if (rounded < 0) return <b className="diff-down">{rounded.toFixed(digits)}{unit}</b>;
	return <b>±0{unit}</b>;
}

function RateCard({
	title,
	href,
	rate,
	target,
	avg,
	rank,
	total,
}: {
	title: string;
	href: string;
	rate: number;
	target: number | null;
	avg: number | null;
	rank: number | null;
	total: number;
}) {
	const ok = target === null ? null : rate <= target;
	return (
		<Link className="card kpi-card kpi-card-link" href={href}>
			<div className="kpi-title">{title}</div>
			<div className="kpi-value">
				{fmt1(rate)}
				<span className="unit">%</span>
			</div>
			<div className="kpi-sub">
				<div className="row">
					<span>目標</span>
					<b>{target === null ? "-" : `${fmt1(target)}%以下`}</b>
				</div>
				<div className="row">
					<span>全店平均</span>
					<b>{avg === null ? "-" : `${fmt1(avg)}%`}</b>
				</div>
				{rank !== null && (
					<div className="row">
						<span>順位</span>
						<b>
							{rank}位 / {total}店舗
						</b>
					</div>
				)}
			</div>
			{ok !== null && (
				<div className="badge-row">
					<span className={`badge ${ok ? "good" : "bad"}`}>{ok ? "良好" : "要改善"}</span>
				</div>
			)}
			<div className="kpi-more">詳細を見る ›</div>
		</Link>
	);
}

function HygieneItem({
	kind,
	name,
	desc,
	submitted,
	required,
}: {
	kind: "daily" | "weekly";
	name: string;
	desc: string;
	submitted: number;
	required: number;
}) {
	const state = submitState(submitted, required);
	const pct = required > 0 ? Math.min(100, (submitted / required) * 100) : 0;
	return (
		<div className={`hygiene-item ${kind}`}>
			<div className="hygiene-head">
				<span className="hygiene-tag">{kind === "daily" ? "DAILY" : "WEEKLY"}</span>
				<span className="name">{name}</span>
				<span className={`badge ${state.tone}`}>{state.label}</span>
			</div>
			<p className="hygiene-desc">{desc}</p>
			<div className="hygiene-count">
				<span>提出枚数</span>
				<span>
					<b>{submitted}</b> / {required} 枚
				</span>
			</div>
			<div className="progress">
				<span style={{ width: `${pct}%` }} />
			</div>
		</div>
	);
}

function HygienePanel({
	hygiene,
	texts,
}: {
	hygiene: HygieneStatus | null;
	texts: UiSettings["texts"];
}) {
	const hygieneUrl =
		process.env.NEXT_PUBLIC_HYGIENE_APP_URL || "https://toriyaro-eisei-v2.web.app";
	return (
		<section className="card">
			<h2 className="section-title">衛生チェックの状況</h2>
			{hygiene ? (
				<>
					<HygieneItem
						kind="daily"
						name="毎日の衛生チェック"
						desc={texts.hygieneDailyDesc}
						submitted={hygiene.dailySubmitted}
						required={hygiene.dailyRequired}
					/>
					<HygieneItem
						kind="weekly"
						name="週次の衛生チェック"
						desc={texts.hygieneWeeklyDesc}
						submitted={hygiene.weeklySubmitted}
						required={hygiene.weeklyRequired}
					/>
					<p className="hygiene-foot">最終提出:{fmtDateTime(hygiene.lastSubmittedAt)}</p>
				</>
			) : (
				<p className="muted">衛生チェックのデータがまだありません。</p>
			)}
			{hygieneUrl && (
				<a className="hygiene-app-link" href={hygieneUrl}>
					衛生チェックを提出する
				</a>
			)}
		</section>
	);
}

function avatarClass(role: string): string {
	if (role === "am" || role === "sv" || role === "hq") return role;
	let hash = 0;
	for (const ch of role) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
	return ["am", "sv", "hq", "c3"][hash % 4];
}

function CommentItem({ comment }: { comment: Comment }) {
	const label = roleLabel(comment.authorRole);
	return (
		<div className="comment">
			<span className={`avatar ${avatarClass(comment.authorRole)}`} aria-hidden>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<circle cx="12" cy="8" r="4" />
					<path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5v1H4z" />
				</svg>
			</span>
			<div>
				<div className="meta">
					{label === comment.authorName ? label : `${label} ${comment.authorName}`}
					<div className="time">{fmtDateTime(comment.createdAt)}</div>
				</div>
				<p className="body">{comment.body}</p>
			</div>
		</div>
	);
}

export default async function DashboardPage() {
	const session = await getSession();
	if (!session || session.role !== "store") redirect("/login");
	const provider = await getProvider();
	const store = await provider.getStoreByCode(session.storeCode);
	if (!store) redirect("/login");

	const [data, uiSettings] = await Promise.all([
		provider.getDashboard(store),
		provider.getUiSettings(),
	]);
	// 衛生チェックは既存の衛生管理アプリからリアルタイム取得(不可ならシート同期値)
	const liveHygiene = await getLiveHygiene([store]);
	const hygiene = liveHygiene.get(store.id) ?? data.hygiene;
	const m: DailyMetrics | null = data.today;
	const prev = data.yesterday;
	const kpiDiff = m && prev ? m.kpiScore - prev.kpiScore : null;
	// KPI の満点は値から自動判定(5 以下なら 5 点満点、超えるなら 100 点満点)
	const kpiIs5 = (m?.kpiScore ?? 0) <= 5;
	const monthly = data.monthlyRankHistory;
	const rankDelta =
		monthly.length >= 2 ? monthly[0].rank - monthly[monthly.length - 1].rank : 0;
	const ann = data.latestAnnouncement;

	return (
		<>
			<header className="site-header">
				<BrandLogo brand={store.brand} />
				<div className="titles">
					<h1>{store.name}</h1>
					<div className="subtitle">{store.brand} 衛生管理</div>
				</div>
				<form action={logout}>
					<button className="logout-btn" type="submit">
						ログアウト
					</button>
				</form>
			</header>
			<main className="page">
				{provider.isMock && (
					<p className="mock-note">
						デモモードで動作中です(Firebase 未設定)。表示されているのはサンプルデータです。
					</p>
				)}
				<p className="updated-at">最終更新:{m ? fmtDateTime(m.updatedAt) : "-"}</p>

				{m ? (
					<div className="kpi-grid">
						<Link className="card kpi-card kpi-card-link" href="/metric/kpi">
							<div className="kpi-title">KPI点数</div>
							<div className="kpi-value">
								{kpiIs5 ? fmt2(m.kpiScore) : fmt1(m.kpiScore)}
								<span className="unit">{kpiIs5 ? "/5" : "/100"}</span>
							</div>
							<div className="kpi-sub">
								<div className="row">
									<span>前日比</span>
									<Diff value={kpiDiff} unit="pt" digits={kpiIs5 ? 2 : 1} />
								</div>
								<div className="row">
									<span>全店平均</span>
									<b>{kpiIs5 ? fmt2(m.kpiAvg) : fmt1(m.kpiAvg)}</b>
								</div>
								{m.kpiRank !== null && (
									<div className="row">
										<span>順位</span>
										<b>
											{m.kpiRank}位 / {m.totalStores}店舗
										</b>
									</div>
								)}
							</div>
							<div className="kpi-more">詳細を見る ›</div>
						</Link>

						<Link className="card kpi-card kpi-card-link" href="/metric/rank">
							<div className="kpi-title">順位</div>
							<div className="kpi-value">
								{m.overallRank}
								<span className="unit">位 / {m.totalStores}店舗</span>
							</div>
							<div className="kpi-sub">
								<div className="row">
									<span>前日</span>
									<b>{prev ? `${prev.overallRank}位` : "-"}</b>
								</div>
							</div>
							<div className="kpi-more">詳細を見る ›</div>
						</Link>

						<RateCard
							title="原価率"
							href="/metric/cost"
							rate={m.costRate}
							target={m.costRateTarget}
							avg={m.costRateAvg}
							rank={m.costRateRank}
							total={m.totalStores}
						/>
						<RateCard
							title="人件費率"
							href="/metric/labor"
							rate={m.laborRate}
							target={m.laborRateTarget}
							avg={m.laborRateAvg}
							rank={m.laborRateRank}
							total={m.totalStores}
						/>

						<Link className="card kpi-card kpi-card-link" href="/qsc">
							<div className="kpi-title">QSCアンケート</div>
							<div className="kpi-value">
								{fmt1(m.qscScore)}
								<span className="unit">/100</span>
							</div>
							<div className="kpi-sub">
								<div className="row">
									<span>順位</span>
									<b>{m.qscRank !== null ? `${m.qscRank}位 / ${m.totalStores}店舗` : "-"}</b>
								</div>
								<div className="row">
									<span>前回</span>
									<b>{m.qscPrevRank !== null ? `${m.qscPrevRank}位` : "-"}</b>
								</div>
							</div>
							<div className="kpi-more">詳細を見る ›</div>
						</Link>
					</div>
				) : (
					<div className="card" style={{ marginBottom: 16 }}>
						<p className="muted">
							KPIデータがまだ同期されていません。スプレッドシート(GAS)からの同期をお待ちください。
						</p>
					</div>
				)}

				<div className="main-grid">
					<HygienePanel hygiene={hygiene} texts={uiSettings.texts} />

					<section className="card">
						<h2 className="section-title">
							1年間の立ち位置 <small>(全店ランキング)</small>
						</h2>
						<p className="muted" style={{ marginBottom: 8 }}>
							総合順位の推移(12ヶ月・各月末時点)
						</p>
						<RankChart
							points={monthly}
							monthly
							threshold={uiSettings.mvpRank}
							thresholdLabel={`MVP候補ライン(${uiSettings.mvpRank}位以内)`}
						/>
						<p className="chart-foot">
							{monthly.length >= 2 && rankDelta !== 0 ? (
								<>
									直近{monthly.length}ヶ月で{" "}
									<span className={rankDelta > 0 ? "delta-up" : "delta-down"}>
										{Math.abs(rankDelta)}位 {rankDelta > 0 ? "↑" : "↓"}
									</span>{" "}
									{rankDelta > 0 ? "アップ" : "ダウン"}
									{" ・ "}
								</>
							) : null}
							上位{uiSettings.mvpRank}位以内で MVP 候補にノミネート
						</p>
					</section>

					<section className="card">
						<h2 className="section-title">
							コメント閲覧 <small>(最新{data.comments.length}件)</small>
						</h2>
						{data.comments.length === 0 ? (
							<p className="muted">コメントはまだありません。</p>
						) : (
							data.comments.map((c) => <CommentItem key={c.id} comment={c} />)
						)}
					</section>
				</div>

				<section className="card announce-bar">
					<span className="label">お知らせ</span>
					{ann ? (
						<>
							{isNew(ann.publishedAt) && <span className="new-badge">NEW</span>}
							<span className="text">
								{fmtMDFromIso(ann.publishedAt)} {ann.title}
								{ann.linkUrl && (
									<>
										{" "}
										詳細は<a href={ann.linkUrl}>こちら</a>
									</>
								)}
							</span>
						</>
					) : (
						<span className="text muted">お知らせはありません。</span>
					)}
					<Link className="announce-all" href="/announcements">
						すべてのお知らせを見る
					</Link>
				</section>
			</main>
		</>
	);
}
