import { createAnnouncement, deleteAnnouncement } from "@/app/admin/actions";
import { getProvider } from "@/lib/data";
import { fmtDateTime, isNew } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
	const provider = await getProvider();
	const announcements = await provider.listAnnouncements();

	return (
		<div className="stack-16">
			<section className="card">
				<h2 className="section-title">お知らせを配信</h2>
				<form action={createAnnouncement}>
					<div className="field">
						<label htmlFor="title">お知らせ本文</label>
						<input
							id="title"
							name="title"
							required
							placeholder="例:夏季の衛生強化キャンペーンを開始しました。"
						/>
					</div>
					<div className="field">
						<label htmlFor="linkUrl">詳細リンク(任意)</label>
						<input id="linkUrl" name="linkUrl" type="url" placeholder="https://..." />
					</div>
					<button className="primary-btn" type="submit" style={{ maxWidth: 240 }}>
						配信する
					</button>
				</form>
			</section>

			<section className="card">
				<h2 className="section-title">配信済みお知らせ</h2>
				{announcements.length === 0 ? (
					<p className="muted">お知らせはまだありません。</p>
				) : (
					announcements.map((a) => (
						<div className="list-item" key={a.id}>
							<div className="grow">
								<div className="muted">
									{fmtDateTime(a.publishedAt)}{" "}
									{isNew(a.publishedAt) && <span className="new-badge">NEW</span>}
								</div>
								<div>
									{a.title}
									{a.linkUrl && (
										<>
											{" "}
											<a href={a.linkUrl}>{a.linkUrl}</a>
										</>
									)}
								</div>
							</div>
							<form action={deleteAnnouncement}>
								<input type="hidden" name="id" value={a.id} />
								<button className="danger-link" type="submit">
									削除
								</button>
							</form>
						</div>
					))
				)}
			</section>
		</div>
	);
}
