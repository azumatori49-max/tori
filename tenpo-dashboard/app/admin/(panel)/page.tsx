import { getProvider } from "@/lib/data";
import { fmt1, fmtDateTime, submitState } from "@/lib/format";
import { getLiveHygiene } from "@/lib/hygiene";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
	const provider = await getProvider();
	const baseRows = await provider.listStoreOverview();
	// 衛生チェックは既存の衛生管理アプリからリアルタイム取得(不可ならシート同期値)
	const liveHygiene = await getLiveHygiene(baseRows.map((r) => r.store));
	const rows = baseRows.map((r) => ({
		...r,
		hygiene: liveHygiene.get(r.store.id) ?? r.hygiene,
	}));
	const sorted = [...rows].sort(
		(a, b) => (a.today?.overallRank ?? 999) - (b.today?.overallRank ?? 999),
	);
	const lastUpdated = rows
		.map((r) => r.today?.updatedAt)
		.filter(Boolean)
		.sort()
		.at(-1);

	return (
		<section className="card">
			<h2 className="section-title">
				店舗一覧 <small>(最終同期:{lastUpdated ? fmtDateTime(lastUpdated) : "未同期"})</small>
			</h2>
			<div className="table-wrap">
				<table className="data">
					<thead>
						<tr>
							<th>総合順位</th>
							<th>店舗コード</th>
							<th>店舗名</th>
							<th>KPI点数</th>
							<th>原価率</th>
							<th>人件費率</th>
							<th>QSC</th>
							<th>衛生チェック(日次)</th>
							<th>衛生チェック(週次)</th>
						</tr>
					</thead>
					<tbody>
						{sorted.map(({ store, today, hygiene }) => {
							const daily = hygiene
								? submitState(hygiene.dailySubmitted, hygiene.dailyRequired)
								: null;
							const weekly = hygiene
								? submitState(hygiene.weeklySubmitted, hygiene.weeklyRequired)
								: null;
							return (
								<tr key={store.id}>
									<td>
										<b>{today ? `${today.overallRank}位` : "-"}</b>
									</td>
									<td>{store.code}</td>
									<td>{store.name}</td>
									<td>{today ? fmt1(today.kpiScore) : "-"}</td>
									<td>{today ? `${fmt1(today.costRate)}%` : "-"}</td>
									<td>{today ? `${fmt1(today.laborRate)}%` : "-"}</td>
									<td>{today?.qscScore !== null && today ? fmt1(today.qscScore) : "-"}</td>
									<td>
										{daily && hygiene ? (
											<>
												<span className={`badge ${daily.tone}`}>{daily.label}</span>{" "}
												{hygiene.dailySubmitted}/{hygiene.dailyRequired}
											</>
										) : (
											"-"
										)}
									</td>
									<td>
										{weekly && hygiene ? (
											<>
												<span className={`badge ${weekly.tone}`}>{weekly.label}</span>{" "}
												{hygiene.weeklySubmitted}/{hygiene.weeklyRequired}
											</>
										) : (
											"-"
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</section>
	);
}
