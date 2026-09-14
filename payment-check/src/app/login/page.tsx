import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const session = getSession();
  if (session) {
    redirect(
      session.mustChange
        ? "/change-password"
        : session.role === "hq"
          ? "/dashboard"
          : "/store"
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-lg text-white">
        🏦
      </div>
      <h1 className="text-xl font-bold text-neutral-900">CHIBIC 入金確認</h1>
      <p className="mt-1 text-xs text-neutral-500">ログイン</p>

      <div className="card mt-6 w-full max-w-sm p-6 shadow-sm">
        <LoginForm />
      </div>

      <p className="mt-8 text-xs text-neutral-400">© 2026 CHIBIC System</p>
    </main>
  );
}
