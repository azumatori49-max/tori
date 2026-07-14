import { saveUiSettings } from "@/app/admin/actions";
import { getProvider } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
	const provider = await getProvider();
	const settings = await provider.getUiSettings();

	return (
		<section className="card">
			<h2 className="section-title">表示設定</h2>
			<p className="muted" style={{ marginBottom: 16 }}>
				らくらく店舗ダッシュボードに表示される文言をここから変更できます。保存するとすぐ反映されます。
			</p>
			<form action={saveUiSettings}>
				<div className="field">
					<label htmlFor="roles">コメントの役職(1行に1つ。上から順に選択肢に表示)</label>
					<textarea id="roles" name="roles" defaultValue={settings.roles.join("\n")} />
				</div>
				<div className="form-grid">
					<div className="field">
						<label htmlFor="mvpRank">MVP候補にノミネートされる順位(◯位以内)</label>
						<input
							id="mvpRank"
							name="mvpRank"
							type="number"
							min={1}
							max={100}
							defaultValue={settings.mvpRank}
						/>
					</div>
					<div className="field">
						<label htmlFor="hygieneDailyDesc">毎日の衛生チェックの説明文</label>
						<input
							id="hygieneDailyDesc"
							name="hygieneDailyDesc"
							defaultValue={settings.texts.hygieneDailyDesc}
						/>
					</div>
					<div className="field">
						<label htmlFor="hygieneWeeklyDesc">週次の衛生チェックの説明文</label>
						<input
							id="hygieneWeeklyDesc"
							name="hygieneWeeklyDesc"
							defaultValue={settings.texts.hygieneWeeklyDesc}
						/>
					</div>
					<div className="field">
						<label htmlFor="betterLowNote">原価率・人件費率の詳細ページの注記</label>
						<input
							id="betterLowNote"
							name="betterLowNote"
							defaultValue={settings.texts.betterLowNote}
						/>
					</div>
					<div className="field">
						<label htmlFor="rankNote">総合順位の詳細ページの注記</label>
						<input id="rankNote" name="rankNote" defaultValue={settings.texts.rankNote} />
					</div>
				</div>
				<button className="primary-btn" type="submit" style={{ maxWidth: 240 }}>
					保存する
				</button>
			</form>
		</section>
	);
}
