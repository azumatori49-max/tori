import { redirect } from "next/navigation";
import { createSession, getSession } from "@/lib/auth";
import { getProvider } from "@/lib/data";

async function loginAdmin(formData: FormData): Promise<void> {
	"use server";
	const password = String(formData.get("password") ?? "");
	const provider = await getProvider();
	const expected = process.env.ADMIN_PASSWORD || (provider.isMock ? "admin" : null);
	if (!expected || password !== expected) redirect("/admin/login?error=1");
	await createSession({ role: "admin" });
	redirect("/admin");
}

export default async function AdminLoginPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await getSession();
	if (session?.role === "admin") redirect("/admin");
	const { error } = await searchParams;
	const provider = await getProvider();

	return (
		<div className="login-wrap">
			<div className="card login-card">
				<h1>本部 管理画面</h1>
				<p className="lead">鶏ヤロー / まる助 / イザカラ / すし鳥酒場</p>
				{provider.isMock && !process.env.ADMIN_PASSWORD && (
					<p className="mock-note">デモモードで動作中です。パスワード「admin」でログインできます。</p>
				)}
				{error && <p className="form-error">パスワードが正しくありません。</p>}
				<form action={loginAdmin}>
					<div className="field">
						<label htmlFor="password">管理パスワード</label>
						<input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							required
						/>
					</div>
					<button className="primary-btn" type="submit">
						ログイン
					</button>
				</form>
			</div>
		</div>
	);
}
