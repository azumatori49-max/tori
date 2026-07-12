import { redirect } from "next/navigation";
import { createSession, getSession } from "@/lib/auth";
import { getProvider } from "@/lib/data";

async function login(formData: FormData): Promise<void> {
	"use server";
	const code = String(formData.get("code") ?? "").trim();
	const password = String(formData.get("password") ?? "");
	const provider = await getProvider();
	const store = await provider.verifyStoreLogin(code, password);
	if (!store) redirect("/login?error=1");
	await createSession({ role: "store", storeCode: store.code });
	redirect("/");
}

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await getSession();
	if (session?.role === "store") redirect("/");
	const { error } = await searchParams;
	const provider = await getProvider();

	return (
		<div className="login-wrap">
			<div className="card login-card">
				<h1>店舗ダッシュボード</h1>
				<p className="lead">STORE DASHBOARD</p>
				{provider.isMock && (
					<p className="mock-note">
						デモモードで動作中です。店舗コード「101」〜「106」、パスワード「demo」でログインできます。
					</p>
				)}
				{error && <p className="form-error">店舗コードまたはパスワードが正しくありません。</p>}
				<form action={login}>
					<div className="field">
						<label htmlFor="code">店舗コード</label>
						<input id="code" name="code" inputMode="numeric" autoComplete="username" required />
					</div>
					<div className="field">
						<label htmlFor="password">パスワード</label>
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
