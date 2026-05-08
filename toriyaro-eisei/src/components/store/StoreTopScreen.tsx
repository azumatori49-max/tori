import type { FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { ReportCard } from './ReportCard';
import { formatDateJa, getDateKey, getWeekKey } from '../../lib/dateUtils';
import { useStoreSubmissionStatus } from '../../hooks/useSubmissions';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  onLogout: () => void;
  onOpenReport: (type: ReportType) => void;
}

export const StoreTopScreen: FC<Props> = ({ storeKey, storeName, onLogout, onOpenReport }) => {
  const todayKey = getDateKey();
  const weekKey = getWeekKey();
  const { submission: daily } = useStoreSubmissionStatus(storeKey, 'daily', todayKey);
  const { submission: weekly } = useStoreSubmissionStatus(storeKey, 'weekly', weekKey);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        title={storeName}
        subtitle="鶏ヤロー・まる助 衛生管理"
        showLogo
        right={
          <button
            type="button"
            onClick={onLogout}
            className="text-xs font-bold text-text-muted hover:text-accent"
          >
            ログアウト
          </button>
        }
      />

      <main className="mx-auto w-full max-w-app px-4 py-5">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border shadow-sm">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulseDot" />
          <span className="text-xs font-bold">{formatDateJa(new Date())}</span>
        </div>

        <div className="space-y-4">
          <ReportCard
            variant="daily"
            title="毎日の衛生チェック"
            description="毎日 7枚の写真を撮影して提出してください"
            submission={daily}
            onOpen={() => onOpenReport('daily')}
          />
          <ReportCard
            variant="weekly"
            title="週次の衛生チェック"
            description="毎週 1回 7枚の写真を撮影して提出してください"
            submission={weekly}
            onOpen={() => onOpenReport('weekly')}
          />
        </div>

        <p className="mt-8 text-center text-[11px] text-text-muted">
          店舗の毎日・毎週の衛生チェック写真を投稿し、本部がまとめて確認できる業務アプリ。
        </p>
      </main>
    </div>
  );
};
