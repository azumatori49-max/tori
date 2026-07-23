import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (getSession()) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="text-center text-2xl font-bold text-slate-900">
          Payment Check
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          入金チェックシステム 管理者ログイン
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
