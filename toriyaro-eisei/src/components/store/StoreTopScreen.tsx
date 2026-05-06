import { useMemo } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { ReportCard } from './ReportCard';
import { formatDateJa, getDateKey, getWeekKey, weekKeyToMonday, formatWeekRangeJa } from '../../lib/dateUtils';
import { useSubmissionFor } from '../../hooks/useSubmissions';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  onOpenReport: (type: ReportType) => void;
  onLogout: () => void;
}

export const StoreTopScreen = ({ storeKey, storeName, onOpenReport, onLogout }: Props) => {
  const todayKey = useMemo(() => getDateKey(), []);
  const weekKey = useMemo(() => getWeekKey(), []);
  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => weekKeyToMonday(weekKey), [weekKey]);

  const daily = useSubmissionFor(storeKey, 'daily', todayKey);
  const weekly = useSubmissionFor(storeKey, 'weekly', weekKey);

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <AppHeader
        title={storeName}
        subtitle="鶏ヤロー・まる助 衛生管理"
        trailing={
          <button type="button" onClick={onLogout} className="btn-ghost px-3 py-1.5 text-xs">
            ログアウト
          </button>
        }
      />

      <main className="flex-1 px-4 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-bold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulseDot" />
            TODAY
          </span>
          <span className="text-sm font-bold">{formatDateJa(today)}</span>
        </div>

        <ReportCard
          type="daily"
          count={daily.submission?.count ?? 0}
          required={7}
          loading={daily.loading}
          submittedAt={daily.submission?.submittedAt}
          onOpen={() => onOpenReport('daily')}
        />

        <ReportCard
          type="weekly"
          count={weekly.submission?.count ?? 0}
          required={7}
          loading={weekly.loading}
          submittedAt={weekly.submission?.submittedAt}
          onOpen={() => onOpenReport('weekly')}
        />

        <p className="text-[11px] text-text-muted text-center mt-2">
          今週: {formatWeekRangeJa(monday)}
        </p>
      </main>
    </div>
  );
};
