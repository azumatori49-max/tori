import { getProvider } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { diagnoseHygiene } from "@/lib/hygiene";

export const dynamic = "force-dynamic";

export default async function HygieneDebugPage() {
	const provider = await getProvider();
	const stores = await provider.listStores();
	const d = await diagnoseHygiene(stores);
	const matchedCount = d.matches.filter((m) => m.matchedKey).length;

	return (
		<div className="stack-16">
			<section className="card">
				<h2 className="section-title">衛生管理アプリ 同期診断</h2>
				<div className="table-wrap">
					<table className="data">
						<tbody>
							<tr>
								<th>読み取り方法</th>
								<td>
									{d.mode === "service-account"
										? "サービスアカウント認証"
										: d.mode === "public-rest"
											? "公開データとして読み取り(認証なし)"
											: "無効化"}
								</td>
							</tr>
							<tr>
								<th>接続先データベース</th>
								<td>{d.rtdbUrl ?? "(無効化されています)"}</td>
							</tr>
							<tr>
								<th>接続結果</th>
								<td>
									{d.connection.ok ? (
										<span className="badge good">接続OK</span>
									) : (
										<>
											<span className="badge bad">接続失敗</span> {d.connection.error}
										</>
									)}
								</td>
							</tr>
							<tr>
								<th>営業日(今日) / 今週のキー</th>
								<td>
									{d.dailyKey} / {d.weeklyKey}
									<span className="muted" style={{ marginLeft: 8 }}>
										※ 朝{d.dayCutoffHour}時までは前日の営業日として扱います
									</span>
								</td>
							</tr>
							<tr>
								<th>提出を探す日付</th>
								<td>{d.dailyKeyCandidates.join(" と ")}</td>
							</tr>
							<tr>
								<th>店舗の一致</th>
								<td>
									{matchedCount} / {d.matches.length} 店舗が一致
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				{!d.connection.ok && d.mode === "public-rest" && (
					<div className="mock-note" style={{ marginTop: 16 }}>
						<b>401(権限エラー)が出ている場合:</b>{" "}
						衛生管理アプリのデータベースは非公開です。同期するには、衛生管理アプリの
						Firebase プロジェクト(toriyaro-eisei-v2)の「プロジェクトの設定 →
						サービスアカウント → 新しい秘密鍵の生成」で JSON をダウンロードし、その中身を
						このアプリ(App Hosting)の環境変数{" "}
						<code>HYGIENE_FIREBASE_SERVICE_ACCOUNT</code>{" "}
						に貼り付けて再デプロイしてください。
					</div>
				)}

				{d.probes.length > 0 && (
					<h3 className="section-title" style={{ marginTop: 20 }}>
						候補URLの接続テスト
					</h3>
				)}
				<div className="table-wrap">
					<table className="data">
						<thead>
							<tr>
								<th>URL</th>
								<th>結果</th>
								<th>店舗データ</th>
							</tr>
						</thead>
						<tbody>
							{d.probes.map((p) => (
								<tr key={p.url}>
									<td style={{ whiteSpace: "normal", wordBreak: "break-all" }}>{p.url}</td>
									<td>
										{p.status === 200 ? (
											<span className="badge good">200 OK</span>
										) : (
											<span className="badge bad">{String(p.status)}</span>
										)}
									</td>
									<td>{p.hasStores ? "あり ✓" : "なし"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section className="card">
				<h2 className="section-title">店舗ごとの状況</h2>
				<div className="table-wrap">
					<table className="data">
						<thead>
							<tr>
								<th>ダッシュボード側の店舗名</th>
								<th>衛生アプリ側の店舗名</th>
								<th>今日の提出(日次)</th>
								<th>今週の提出(週次)</th>
							</tr>
						</thead>
						<tbody>
							{d.matches.map((m) => (
								<tr key={m.storeName}>
									<td>{m.storeName}</td>
									<td>
										{m.matchedName ?? <span className="badge bad">一致なし</span>}
										{m.error && <span className="badge bad">取得エラー: {m.error}</span>}
									</td>
									<td>
										{m.matchedKey
											? m.daily
												? `${m.daily.count}枚 (${fmtDateTime(m.daily.submittedAt)})`
												: "提出なし"
											: "-"}
									</td>
									<td>
										{m.matchedKey
											? m.weekly
												? `${m.weekly.count}枚 (${fmtDateTime(m.weekly.submittedAt)})`
												: "提出なし"
											: "-"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="muted" style={{ marginTop: 12 }}>
					「一致なし」の店舗は、スプレッドシートの店舗マスタの店舗名を上の「衛生管理アプリの登録店舗」
					のいずれかと同じにして「⑤ 店舗をアプリに登録」を再実行すると同期されます。
				</p>
			</section>

			{d.connection.ok && (
				<section className="card">
					<h2 className="section-title">
						衛生管理アプリの登録店舗 <small>({d.appStoreNames.length}件)</small>
					</h2>
					<p style={{ fontSize: 13 }}>{d.appStoreNames.join(" / ")}</p>
				</section>
			)}
		</div>
	);
}
