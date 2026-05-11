import { useMemo } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { ReportCard } from './ReportCard';
import { useSubmission } from '../../hooks/useSubmissions';
import { formatDateJa, getDateKey, getWeekKey } from '../../lib/dateUtils';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  onLogout: () => void;
  onStart: (type: ReportType) => void;
}

export const StoreTopScreen = ({ storeKey, storeName, onLogout, onStart }: Props) => {
  const todayKey = useMemo(() => getDateKey(), []);
  const weekKey = useMemo(() => getWeekKey(), []);
  const today = useMemo(() => new Date(), []);

  const daily = useSubmission(storeKey, 'daily', todayKey);
  const weekly = useSubmission(storeKey, 'weekly', weekKey);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title={storeName} subtitle="衛生管理" onLogout={onLogout} />
      <div className="mx-auto w-full max-w-app flex-1 px-4 py-5">
        <div className="mb-5 flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-text shadow-sm ring-1 ring-border w-fit">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          {formatDateJa(today)}
        </div>
        <div className="space-y-3">
          <ReportCard type="daily" submission={daily.submission} onStart={() => onStart('daily')} />
          <ReportCard type="weekly" submission={weekly.submission} onStart={() => onStart('weekly')} />
        </div>
        <p className="mt-6 text-center text-[11px] text-text-muted">
          各項目は7枚すべて撮影すると提出完了になります
        </p>
      </div>
    </div>
  );
};
