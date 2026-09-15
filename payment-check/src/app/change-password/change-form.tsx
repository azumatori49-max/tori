"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: form.get("password"),
          confirm: form.get("confirm"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "変更に失敗しました");
        setPending(false);
        return;
      }
      router.push(data.role === "hq" ? "/dashboard" : "/store");
      router.refresh();
    } catch {
      setError("通信に失敗しました。もう一度お試しください");
      setPending(false);
    }
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-xs font-medium text-neutral-600"
          >
            新しいパスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            className="input"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            8 文字以上、英字と数字を含めること
          </p>
        </div>
        <div>
          <label
            htmlFor="confirm"
            className="mb-1 block text-xs font-medium text-neutral-600"
          >
            新しいパスワード（確認用）
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            className="input"
          />
        </div>
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "変更中..." : "変更して続行"}
        </button>
      </form>
      <div className="mt-4 text-center">
        <button
          onClick={onLogout}
          className="text-xs text-neutral-500 underline hover:text-neutral-800"
        >
          ログアウトする
        </button>
      </div>
    </>
  );
}
