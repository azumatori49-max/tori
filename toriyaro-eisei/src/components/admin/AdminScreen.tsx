import { useEffect, useMemo, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { DashboardTab } from './DashboardTab';
import { StoreManageTab } from './StoreManageTab';
import { FeedbackTab } from './FeedbackTab';
import { QrShareCard } from './QrShareCard';
import { AiAssistantCard } from './AiAssistantCard';
import { MonthlyReportCard } from './MonthlyReportCard';
import { ReferralsTab } from './ReferralsTab';
import { useAllReferrals } from '../../hooks/useReferrals';
import { formatDateJa } from '../../lib/dateUtils';
import { maybeRunDailyCleanup } from '../../lib/cleanup';
import type { AdminTab, Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
  onLogout: () => void;
}

export const AdminScreen: FC<Props> = ({ stores, onLogout }) => {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const { items: referrals } = useAllReferrals();
  const pendingCount = useMemo(
    () => (referrals ?? []).filter((r) => r.status === 'pending').length,
    [referrals],
  );

  useEffect(() => {
    void maybeRunDailyCleanup();
  }, []);

  return (
    <div className="min-h-screen bg-bg pb-20">
      <AppHeader
        title="管理者ダッシュボード"
        subtitle={formatDateJa(new Date())}
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

           <main className="mx-auto w-full max-w-app px-4 py-4">
        <QrShareCard />
        <AiAssistantCard />
        {tab === 'dashboard' && (
          <>
            <MonthlyReportCard stores={stores} />
            <DashboardTab stores={stores} />
          </>
        )}
        {tab === 'stores' && <StoreManageTab stores={stores} />}
        {tab === 'feedback' && <FeedbackTab stores={stores} />}
        {tab === 'referrals' && <ReferralsTab />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-app grid-cols-4">
          {(
            [
              { key: 'dashboard', label: '提出確認' },
              { key: 'stores', label: '店舗管理' },
              { key: 'referrals', label: '申請' },
              { key: 'feedback', label: 'ご意見' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition ${
                tab === item.key ? 'text-accent' : 'text-text-muted'
              }`}
            >
              {item.label}
              {item.key === 'referrals' && pendingCount > 0 && (
                <span className="absolute right-3 top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-ng px-1 text-[10px] font-bold leading-[16px] text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};