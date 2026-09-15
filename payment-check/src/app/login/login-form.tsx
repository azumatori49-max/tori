"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          remember: form.get("remember") === "on",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました");
        setPending(false);
        return;
      }
      router.push(
        data.mustChange
          ? "/change-password"
          : data.role === "hq"
            ? "/dashboard"
            : "/store"
      );
      router.refresh();
    } catch {
      setError("通信に失敗しました。もう一度お試しください");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-xs font-medium text-neutral-600"
        >
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="your@example.com"
          className="input"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-xs font-medium text-neutral-600"
        >
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="input"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          name="remember"
          defaultChecked
          className="h-4 w-4"
        />
        ログイン状態を保持する（30日間）
      </label>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "確認中..." : "ログイン"}
      </button>
      <p className="text-center text-[11px] text-neutral-400">
        ブラウザの「パスワードを保存」を使うと、次回から入力を省略できます
      </p>
    </form>
  );
}
