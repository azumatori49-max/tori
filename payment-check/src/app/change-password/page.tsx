import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ChangePasswordForm } from "./change-form";

export const dynamic = "force-dynamic";

export default function ChangePasswordPage() {
  const session = getSession();
  if (!session) redirect("/login");
  if (!session.mustChange) {
    redirect(session.role === "hq" ? "/dashboard" : "/store");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-lg text-white">
        🔑
      </div>
      <h1 className="text-lg font-bold text-neutral-900">
        初回ログイン: パスワード変更
      </h1>
      <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-neutral-500">
        管理者から発行されたパスワードを変更してください。
        <br />
        変更が完了するまで他の画面にはアクセスできません。
      </p>

      <div className="card mt-6 w-full max-w-sm p-6 shadow-sm">
        <ChangePasswordForm />
      </div>
    </main>
  );
}
