import { AppHeader } from "../layout/AppHeader";
import { ReportCard } from "./ReportCard";
import { useStoreSubmission } from "../../hooks/useSubmissions";
import {
  formatDateJa,
  getDateKey,
  getWeekKey,
  getMondayOf,
} from "../../lib/dateUtils";
import type { ReportType, StoreKey } from "../../types";

interface Props {
  storeKey: StoreKey;
  storeName: string;
  onOpenUpload: (type: ReportType) => void;
  onLogout: () => void;
}

export const StoreTopScreen = ({
  storeKey,
  storeName,
  onOpenUpload,
  onLogout,
}: Props) => {
  const today = new Date();
  const dateKey = getDateKey();
  const weekKey = getWeekKey();
  const mon = getMondayOf(today);

  const { submission: daily } = useStoreSubmission(storeKey, "daily", dateKey);
  const { submission: weekly } = useStoreSubmission(storeKey, "weekly", weekKey);

  return (
    <div className="mx-auto flex min-h-full max-w-app flex-col">
      <AppHeader
        title={storeName}
        subtitle="鶏ヤロー・まる助 衛生管理"
        onLogout={onLogout}
      />

      <div className="px-5 py-5">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-sm">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" />
          {formatDateJa(today)}
        </div>

        <div className="space-y-3">
          <ReportCard
            variant="daily"
            title="デイリー報告"
            description="毎日7枚 — 開店前のチェックポイントを撮影してください。"
            count={daily?.count ?? 0}
            onOpen={() => onOpenUpload("daily")}
          />
          <ReportCard
            variant="weekly"
            title="ウィークリー報告"
            description={`今週（${mon.getMonth() + 1}/${mon.getDate()}〜）の特別チェック7枚。`}
            count={weekly?.count ?? 0}
            onOpen={() => onOpenUpload("weekly")}
          />
        </div>

        <p className="mt-8 text-center text-[11px] text-muted">
          毎日のクリーンを、写真でかんたん。
        </p>
      </div>
    </div>
  );
};
