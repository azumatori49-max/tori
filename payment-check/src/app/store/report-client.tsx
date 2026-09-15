"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyReport } from "@/lib/types";

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function StoreReportClient({
  userName,
  storeName,
  reports,
}: {
  userName: string;
  storeName: string;
  reports: DailyReport[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(todayStr());
  const [deposit, setDeposit] = useState("");
  const [sales, setSales] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function addPhoto(file: File) {
    if (file.size > 300_000) {
      setError("写真は300KB以下にしてください");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((p) => [...p, reader.result as string].slice(0, 4));
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setPending(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        manualDeposit: deposit.trim() ? Number(deposit) : null,
        manualSales: sales.trim() ? Number(sales) : null,
        comment: comment.trim() || null,
        photos,
      }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "送信に失敗しました");
      return;
    }
    setMessage("報告を送信しました");
    router.refresh();
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{storeName} 日次報告</h1>
          <p className="text-xs text-neutral-500">{userName}</p>
        </div>
        <button className="btn-outline" onClick={onLogout}>
          ログアウト
        </button>
      </div>

      <div className="card mt-4 space-y-3 p-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            対象日
          </label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              入金額（手動・円）
            </label>
            <input
              type="number"
              className="input"
              placeholder="例: 98000"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              現金売上（手動・円）
            </label>
            <input
              type="number"
              className="input"
              placeholder="例: 100000"
              value={sales}
              onChange={(e) => setSales(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            コメント
          </label>
          <textarea
            rows={3}
            className="input"
            placeholder="本部への連絡事項"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            写真（最大4枚・各300KBまで）
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {photos.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`添付${i + 1}`}
                  className="h-20 w-16 rounded-md border border-neutral-200 object-cover"
                />
                <button
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] text-white"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <label className="flex h-20 w-16 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-neutral-300 text-xl text-neutral-400 hover:border-neutral-500">
              +
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) addPhoto(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        <button className="btn-primary w-full" disabled={pending} onClick={submit}>
          {pending ? "送信中..." : "報告を送信"}
        </button>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-bold">最近の報告</h2>
      <div className="card overflow-x-auto">
        {reports.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-400">
            まだ報告がありません
          </p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="th">日付</th>
                <th className="th text-right">入金額</th>
                <th className="th text-right">現金売上</th>
                <th className="th">コメント</th>
                <th className="th">写真</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                  <td className="td">{r.date.replace(/-/g, "/")}</td>
                  <td className="td text-right tabular-nums">
                    {r.manual_deposit !== null ? yen(r.manual_deposit) : "—"}
                  </td>
                  <td className="td text-right tabular-nums">
                    {r.manual_sales !== null ? yen(r.manual_sales) : "—"}
                  </td>
                  <td className="td max-w-40 truncate text-neutral-500">
                    {r.comment ?? "—"}
                  </td>
                  <td className="td">
                    {JSON.parse(r.photos_json || "[]").length > 0 ? "あり" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
