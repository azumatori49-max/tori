import Link from "next/link";
import { redirect } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/data";
import { fmt1 } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QscDetailPage() {
	const session = await getSession();
	if (!session || session.role !== "store") redirect("/login");
	const provider = await getProvider();
	const store = await provider.getStoreByCode(session.storeCode);
	if (!store) redirect("/login");

	const data = await provider.getDashboard(store);
	const m = data.today;
	// andy は公開リンク・API 非対応のため、外部リンクは
	// 店舗マスタの「QSC詳細URL」等で明示的に設定された場合のみ表示する
	const externalUrl = store.qscUrl || process.env.NEXT_PUBLIC_QSC_APP_URL || null;

	return (
		<>
			<header className="site-header">
				<BrandLogo brand={store.brand} />
				<div className="titles">
					<h1>QSCアンケート詳細</h1>
					<div className="subtitle">{store.name}</div>
				</div>
				<Link className="logout-btn" href="/">
					戻る
				</Link>
			</header>
			<main className="page" style={{ maxWidth: 760 }}>
				{m?.qscScore !== null && m?.qscScore !== undefined ? (
					<div className="stack-16">
						<section className="card">
							<div className="qsc-summary">
								<div>
									<div className="kpi-title">総合点</div>
									<div className="kpi-value">
										{fmt1(m.qscScore)}
										<span className="unit">/100</span>
									</div>
								</div>
								<div className="qsc-summary-sub">
									<div className="row">
										<span>順位</span>
										<b>{m.qscRank !== null ? `${m.qscRank}位 / ${m.totalStores}店舗` : "-"}</b>
									</div>
									<div className="row">
										<span>前回順位</span>
										<b>{m.qscPrevRank !== null ? `${m.qscPrevRank}位` : "-"}</b>
									</div>
									<div className="row">
										<span>回答数</span>
										<b>{m.qscAnswers !== null ? `${m.qscAnswers}件` : "-"}</b>
									</div>
								</div>
							</div>
						</section>

						<section className="card">
							<h2 className="section-title">設問ごとの点数</h2>
							{m.qscQuestions && m.qscQuestions.length > 0 ? (
								m.qscQuestions.map((q) => (
									<div className="qsc-q" key={q.label}>
										<div className="qsc-q-head">
											<span>{q.label}</span>
											<b>{q.score !== null ? fmt1(q.score) : "回答なし"}</b>
										</div>
										<div className="progress">
											<span style={{ width: `${Math.min(100, q.score ?? 0)}%` }} />
										</div>
									</div>
								))
							) : (
								<p className="muted">
									設問ごとの点数はまだ同期されていません。スプレッドシートの「③ 今すぐ同期」を実行すると表示されます。
								</p>
							)}
						</section>

						{externalUrl && (
							<a className="hygiene-app-link" href={externalUrl} target="_blank" rel="noreferrer">
								アンケート回答の詳細を見る
							</a>
						)}
					</div>
				) : (
					<section className="card">
						<p className="muted">今月のアンケート回答がまだありません。</p>
					</section>
				)}
			</main>
		</>
	);
}
