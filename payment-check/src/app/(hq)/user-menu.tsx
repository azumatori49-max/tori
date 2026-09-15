"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserMenu({ name }: { name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-neutral-200 py-1 pl-1 pr-2.5 text-sm text-neutral-700 transition hover:bg-neutral-100"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold">
          {name.slice(0, 1)}
        </span>
        <span className="max-w-32 truncate text-[13px]">{name}</span>
        <span className="text-[10px] text-neutral-400">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            <button
              onClick={onLogout}
              className="block w-full px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100"
            >
              ログアウト
            </button>
          </div>
        </>
      )}
    </div>
  );
}
