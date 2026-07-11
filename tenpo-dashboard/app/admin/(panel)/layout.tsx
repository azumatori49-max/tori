import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { getSession } from "@/lib/auth";
import { getProvider } from "@/lib/data";
import { logoutAdmin } from "@/app/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const session = await getSession();
	if (session?.role !== "admin") redirect("/admin/login");
	const provider = await getProvider();

	return (
		<>
			<header className="site-header">
				<span className="logo">鶏</span>
				<div className="titles">
					<h1>本部 管理画面</h1>
					<div className="subtitle">鶏ヤロー・まる助 衛生管理</div>
				</div>
				<form action={logoutAdmin}>
					<button className="logout-btn" type="submit">
						ログアウト
					</button>
				</form>
			</header>
			<main className="page">
				{provider.isMock && (
					<p className="mock-note">
						デモモードで動作中です(Firebase 未設定)。ここでの変更はサーバー再起動で消えます。
					</p>
				)}
				<AdminNav />
				{children}
			</main>
		</>
	);
}
