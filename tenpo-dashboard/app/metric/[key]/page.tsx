import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import RankChart from "@/components/RankChart";
import TrendChart from "@/components/TrendChart";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/data";
import { fmt1, fmt2 } from "@/lib/format";
import type { DailyMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";

type MetricConfig = {
	title: string;
	unit: string;
	digits: number;
	betterNote?: string;
	value: (m: DailyMetrics) => number | null;
	rank: (m: DailyMetrics) => number | null;
	target?: (m: DailyMetrics) => number | null;
	avg?: (m: DailyMetrics) => number | null;
};

const CONFIGS: Record<string, MetricConfig> = {
	kpi: {
		title: "KPI点数",
		unit: "",
		digits: 2,
		value: (m) => m.kpiScore,
		rank: (m) => m.kpiRank,
		avg: (m) => m.kpiAvg,
	},
	cost: {
		title: "原価率",
		unit: "%",
		digits: 1,
		betterNote: "低いほど良い指標です",
		value: (m) => m.costRate,
		rank: (m) => m.costRateRank,
		target: (m) => m.costRateTarget,
		avg: (m) => m.costRateAvg,
	},
	labor: {
		title: "人件費率",
		unit: "%",
		digits: 1,
		betterNote: "低いほど良い指標です",
		value: (m) => m.laborRate,
		rank: (m) => m.laborRateRank,
		target: (m) => m.laborRateTarget,
		avg: (m) => m.laborRateAvg,
	},
};

export default async function MetricDetailPage({
	params,
}: {
	params: Promise<{ key: string }>;
}) {
	const { key } = await params;
	const isRank = key === "rank";
	const config = CONFIGS[key];
	if (!isRank && !config) notFound();

	const session = await getSession();
	if (!session || session.role !== "store") redirect("/login");
	const provider = await getProvider();
	const store = await provider.getStoreByCode(session.storeCode);
	if (!store) redirect("/login");

	const [data, uiSettings] = await Promise.all([
		provider.getDashboard(store),
		provider.getUiSettings(),
	]);
	const m = data.today;
	// KPI の満点は値から自動判定(5 以下なら 5 点満点、超えるなら 100 点満点)
	const kpiIs5 = key === "kpi" && (m?.kpiScore ?? 0) <= 5;
	const digits = key === "kpi" ? (kpiIs5 ? 2 : 1) : config?.digits ?? 1;
	const fmt = (v: number | null | undefined) =>
		v === null || v === undefined ? "-" : v.toFixed(digits);
	const betterNote = config?.betterNote ? uiSettings.texts.betterLowNote : null;

	return (
		<>
			<header className="site-header">
				<BrandLogo brand={store.brand} />
				<div className="titles">
					<h1>{isRank ? "総合順位の詳細" : `${config.title}の詳細`}</h1>
					<div className="subtitle">{store.name}</div>
				</div>
				<Link className="logout-btn" href="/">
					戻る
				</Link>
			</header>
			<main className="page" style={{ maxWidth: 760 }}>
				{!m ? (
					<section className="card">
						<p className="muted">データがまだ同期されていません。</p>
					</section>
				) : isRank ? (
					<div className="stack-16">
						<section className="card">
							<div className="qsc-summary">
								<div>
									<div className="kpi-title">総合順位</div>
									<div className="kpi-value">
										{m.overallRank}
										<span className="unit">位 / {m.totalStores}店舗</span>
									</div>
								</div>
								<div className="qsc-summary-sub">
									<div className="row">
										<span>前日</span>
										<b>{data.yesterday ? `${data.yesterday.overallRank}位` : "-"}</b>
									</div>
								</div>
							</div>
							<p className="muted" style={{ marginTop: 10 }}>
								{uiSettings.texts.rankNote}
							</p>
						</section>
						<section className="card">
							<h2 className="section-title">指標ごとの順位</h2>
							<div className="table-wrap">
								<table className="data">
									<tbody>
										<tr>
											<th>KPI点数</th>
											<td>{fmt2(m.kpiScore)}</td>
											<td>{m.kpiRank !== null ? `${m.kpiRank}位` : "-"}</td>
										</tr>
										<tr>
											<th>原価率</th>
											<td>{fmt1(m.costRate)}%</td>
											<td>{m.costRateRank !== null ? `${m.costRateRank}位` : "-"}</td>
										</tr>
										<tr>
											<th>人件費率</th>
											<td>{fmt1(m.laborRate)}%</td>
											<td>{m.laborRateRank !== null ? `${m.laborRateRank}位` : "-"}</td>
										</tr>
										<tr>
											<th>QSCアンケート</th>
											<td>{m.qscScore !== null ? fmt1(m.qscScore) : "-"}</td>
											<td>{m.qscRank !== null ? `${m.qscRank}位` : "-"}</td>
										</tr>
									</tbody>
								</table>
							</div>
						</section>
						<section className="card">
							<h2 className="section-title">総合順位の推移</h2>
							<RankChart points={data.rankHistory} />
						</section>
					</div>
				) : (
					<div className="stack-16">
						<section className="card">
							<div className="qsc-summary">
								<div>
									<div className="kpi-title">{config.title}</div>
									<div className="kpi-value">
										{fmt(config.value(m))}
										<span className="unit">
											{config.unit}
											{key === "kpi" ? (kpiIs5 ? " /5" : " /100") : ""}
										</span>
									</div>
								</div>
								<div className="qsc-summary-sub">
									<div className="row">
										<span>順位</span>
										<b>
											{config.rank(m) !== null
												? `${config.rank(m)}位 / ${m.totalStores}店舗`
												: "-"}
										</b>
									</div>
									{config.target && (
										<div className="row">
											<span>目標</span>
											<b>
												{config.target(m) !== null
													? `${fmt(config.target(m))}${config.unit}以下`
													: "-"}
											</b>
										</div>
									)}
									{config.avg && (
										<div className="row">
											<span>全店平均</span>
											<b>
												{config.avg(m) !== null ? `${fmt(config.avg(m))}${config.unit}` : "-"}
											</b>
										</div>
									)}
								</div>
							</div>
							{betterNote && (
								<p className="muted" style={{ marginTop: 10 }}>
									{betterNote}
								</p>
							)}
						</section>

						<section className="card">
							<h2 className="section-title">{config.title}の推移</h2>
							<TrendChart
								points={data.history.map((h) => ({ date: h.date, value: config.value(h) }))}
								unit={config.unit}
								digits={digits}
								target={config.target ? config.target(m) : null}
							/>
						</section>

						<section className="card">
							<h2 className="section-title">順位の推移</h2>
							<RankChart
								points={data.history
									.filter((h) => config.rank(h) !== null)
									.map((h) => ({ date: h.date, rank: config.rank(h)! }))}
							/>
						</section>
					</div>
				)}
			</main>
		</>
	);
}
