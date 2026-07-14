import Link from "next/link";
import { redirect } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/data";
import { fmtDateTime, isNew } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
	const session = await getSession();
	if (!session) redirect("/login");
	const provider = await getProvider();
	const announcements = await provider.listAnnouncements();

	return (
		<>
			<header className="site-header">
				<BrandLogo />
				<div className="titles">
					<h1>お知らせ一覧</h1>
					<div className="subtitle">らくらく店舗ダッシュボード</div>
				</div>
				<Link className="logout-btn" href={session.role === "admin" ? "/admin" : "/"}>
					戻る
				</Link>
			</header>
			<main className="page">
				<section className="card">
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
												詳細は<a href={a.linkUrl}>こちら</a>
											</>
										)}
									</div>
								</div>
							</div>
						))
					)}
				</section>
			</main>
		</>
	);
}
