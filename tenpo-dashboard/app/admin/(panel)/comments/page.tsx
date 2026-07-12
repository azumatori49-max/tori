import { createComment, deleteComment } from "@/app/admin/actions";
import { getProvider } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
	const provider = await getProvider();
	const [stores, comments, settings] = await Promise.all([
		provider.listStores(),
		provider.listComments(50),
		provider.getUiSettings(),
	]);

	return (
		<div className="stack-16">
			<section className="card">
				<h2 className="section-title">コメントを送信</h2>
				<form action={createComment}>
					<div className="form-grid">
						<div className="field">
							<label htmlFor="storeId">宛先店舗</label>
							<select id="storeId" name="storeId" defaultValue="all">
								<option value="all">全店舗</option>
								{stores.map((s) => (
									<option key={s.id} value={s.id}>
										{s.code} {s.name}
									</option>
								))}
							</select>
						</div>
						<div className="field">
							<label htmlFor="authorRole">役職(表示設定タブで編集できます)</label>
							<select id="authorRole" name="authorRole" defaultValue={settings.roles[0]}>
								{settings.roles.map((r) => (
									<option key={r} value={r}>
										{r}
									</option>
								))}
							</select>
						</div>
					</div>
					<div className="field">
						<label htmlFor="authorName">担当者名</label>
						<input id="authorName" name="authorName" required placeholder="例:田中" />
					</div>
					<div className="field">
						<label htmlFor="body">コメント本文</label>
						<textarea id="body" name="body" required />
					</div>
					<button className="primary-btn" type="submit" style={{ maxWidth: 240 }}>
						送信する
					</button>
				</form>
			</section>

			<section className="card">
				<h2 className="section-title">送信済みコメント</h2>
				{comments.length === 0 ? (
					<p className="muted">コメントはまだありません。</p>
				) : (
					comments.map((c) => (
						<div className="list-item" key={c.id}>
							<div className="grow">
								<div className="muted">
									{fmtDateTime(c.createdAt)}/{c.storeName ?? "全店舗"}/
									{roleLabel(c.authorRole)} {c.authorName}
								</div>
								<div>{c.body}</div>
							</div>
							<form action={deleteComment}>
								<input type="hidden" name="id" value={c.id} />
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
