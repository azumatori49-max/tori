import { useMemo } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { ReportCard } from './ReportCard';
import { useStoreSubmission } from '../../hooks/useSubmissions';
import { formatDateJa, getDateKey, getWeekKey } from '../../lib/dateUtils';
import { getSlotCount } from '../../data/reportItems';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  onLogout: () => void;
  onOpenUpload: (type: ReportType) => void;
}

export const StoreTopScreen = ({ storeKey, storeName, onLogout, onOpenUpload }: Props) => {
  const todayKey = useMemo(() => getDateKey(), []);
  const weekKey = useMemo(() => getWeekKey(), []);
  const todayLabel = useMemo(() => formatDateJa(new Date()), []);

  const daily = useStoreSubmission(storeKey, 'daily', todayKey);
  const weekly = useStoreSubmission(storeKey, 'weekly', weekKey);

  return (
    <div className="min-h-full flex flex-col">
      <AppHeader title={storeName} onLogout={onLogout} />
      <main className="flex-1 max-w-screen-sm w-full mx-auto px-4 py-5 space-y-4">
        <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-3 py-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
          <span className="text-xs font-bold">{todayLabel}</span>
        </div>

        <ReportCard
          type="daily"
          title="デイリー衛生チェック"
          description="毎日決められた7か所の衛生管理写真を撮影してください。"
          count={daily.submission?.count ?? 0}
          total={getSlotCount('daily')}
          loading={daily.loading}
          onOpen={() => onOpenUpload('daily')}
        />

        <ReportCard
          type="weekly"
          title="ウィークリー衛生チェック"
          description="週に1回（月曜起算）、8項目の衛生管理写真を提出してください。"
          count={weekly.submission?.count ?? 0}
          total={getSlotCount('weekly')}
          loading={weekly.loading}
          onOpen={() => onOpenUpload('weekly')}
        />

        <div className="bg-surface2 rounded-xl p-4 text-xs text-text-muted leading-relaxed">
          <p className="font-bold text-text mb-1">📌 ご注意</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>各カードをタップして撮影画面を開いてください。</li>
            <li>7枚すべて撮影してから提出ボタンを押してください。</li>
            <li>提出後の差し替えは管理者にご連絡ください。</li>
          </ul>
        </div>
      </main>
    </div>
  );
};
