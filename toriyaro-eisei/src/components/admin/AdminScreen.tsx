import { useState } from "react";
import { AdminNav } from "../layout/AdminNav";
import { DashboardTab } from "./DashboardTab";
import { StoreManageTab } from "./StoreManageTab";
import type { AdminTab } from "../../types";
import { formatDateJa } from "../../lib/dateUtils";

export const AdminScreen = ({ onLogout }: { onLogout: () => void }) => {
  const [tab, setTab] = useState<AdminTab>("dashboard");

  return (
    <div className="mx-auto flex min-h-full max-w-app flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <img src="/logo.svg" alt="" className="h-9 w-9 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-ink">
            管理者ダッシュボード
          </div>
          <div className="truncate text-[11px] text-muted">
            {formatDateJa(new Date())}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted hover:bg-surface2"
        >
          ログアウト
        </button>
      </header>

      <main className="flex-1 pb-2">
        {tab === "dashboard" ? <DashboardTab /> : <StoreManageTab />}
      </main>

      <AdminNav active={tab} onChange={setTab} />
    </div>
  );
};
