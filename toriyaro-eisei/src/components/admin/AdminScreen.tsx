import { useEffect, useMemo, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { VersionText } from '../system/VersionText';
import { DashboardTab } from './DashboardTab';
import { StoreManageTab } from './StoreManageTab';
import { FeedbackTab } from './FeedbackTab';
import { QrShareCard } from './QrShareCard';
import { AiAssistantCard } from './AiAssistantCard';
import { MonthlyReportCard } from './MonthlyReportCard';
import { ReferralsTab } from './ReferralsTab';
import { ScheduleTab } from './ScheduleTab';
import { useAllReferrals } from '../../hooks/useReferrals';
import { formatDateJa } from '../../lib/dateUtils';
import { CLEANUP_ENABLED, maybeRunDailyCleanup } from '../../lib/cleanup';
import type { AdminTab, Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
  onLogout: () => void;
}

const TOOLS_OPEN_KEY = 'admin_tools_open_v1';

export const AdminScreen: FC<Props> = ({ stores, onLogout }) => {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const { items: referrals } = useAllReferrals();
  const pendingCount = useMemo(
    () => (referrals ?? []).filter((r) => r.status === 'pending').length,
    [referrals],
  );

  useEffect(() => {
    // 自動クリーンアップは一時停止中（理由は lib/cleanup.ts の CLEANUP_ENABLED を参照）
    if (CLEANUP_ENABLED) {
      void maybeRunDailyCleanup();
    }
  }, []);

  // 「ツール」（QRコード・AIアシスタント・月次レポート）の開閉は端末に覚えさせる
  const [toolsOpen, setToolsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TOOLS_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleTools = () => {
    setToolsOpen((v) => {
      try {
        localStorage.setItem(TOOLS_OPEN_KEY, v ? '0' : '1');
      } catch {
        // 保存できなくても動作には影響しない
      }
      return !v;
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg pb-20 lg:pb-10">
      <AppHeader
        title="管理者ダッシュボード"
        subtitle={formatDateJa(new Date())}
        showLogo
        wide
        right={
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-[44px] items-center whitespace-nowrap px-1 text-xs font-bold text-text-muted hover:text-accent"
          >
            ログアウト
          </button>
        }
      />

      {/* PC（1024px以上）では本文を広く使う。スマホ幅は今までどおり1列 */}
      <main className="mx-auto w-full max-w-app px-4 py-4 lg:order-2 lg:max-w-[1200px] lg:px-6">
        {tab === 'dashboard' && (
          <>
            {/* 提出確認のときだけ出す。ふだんは1行に畳んでおく */}
            <div className="mb-4 rounded-2xl border border-border bg-surface shadow-sm">
              <button
                type="button"
                onClick={toggleTools}
                aria-expanded={toolsOpen}
                className="flex min-h-[48px] w-full items-center justify-between gap-2 px-4 text-left"
              >
                <span className="text-sm font-bold">
                  ツール
                  <span className="ml-2 text-xs font-normal text-text-muted">
                    QRコード・AIアシスタント・月次レポート
                  </span>
                </span>
                <span className="text-text-muted" aria-hidden="true">{toolsOpen ? '▲' : '▼'}</span>
              </button>
              {toolsOpen && (
                <div className="border-t border-border px-3 pt-4 lg:grid lg:grid-cols-2 lg:gap-x-4">
                  <QrShareCard />
                  <AiAssistantCard />
                  <div className="lg:col-span-2">
                    <MonthlyReportCard stores={stores} />
                  </div>
                </div>
              )}
            </div>
            <DashboardTab stores={stores} />
          </>
        )}
        {tab === 'stores' && <StoreManageTab stores={stores} />}
        {tab === 'feedback' && <FeedbackTab stores={stores} />}
        {tab === 'referrals' && <ReferralsTab />}
        {tab === 'schedules' && <ScheduleTab stores={stores} />}
        <VersionText className="mt-8" />
      </main>

      {/* スマホは画面下のメニュー、PCはヘッダーのすぐ下の横並びタブ */}
      <nav
        className="admin-nav fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:sticky lg:inset-x-auto lg:bottom-auto lg:order-1 lg:border-b lg:border-t-0"
        aria-label="管理メニュー"
      >
        <div className="mx-auto grid w-full max-w-app grid-cols-5 lg:flex lg:max-w-[1200px] lg:gap-1 lg:px-6">
          {(
            [
              { key: 'dashboard', label: '提出確認' },
              { key: 'stores', label: '店舗管理' },
              { key: 'schedules', label: '年間予定' },
              { key: 'referrals', label: '申請' },
              { key: 'feedback', label: 'ご意見' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-current={tab === item.key ? 'page' : undefined}
              className={`relative flex min-h-[48px] flex-col items-center justify-center gap-0.5 whitespace-nowrap px-1 text-xs font-bold transition lg:flex-row lg:border-b-2 lg:px-5 lg:text-sm ${
                tab === item.key ? 'text-accent lg:border-accent' : 'text-text-muted lg:border-transparent'
              }`}
            >
              {item.label}
              {item.key === 'referrals' && pendingCount > 0 && (
                <span className="absolute right-2 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-ng px-1 text-xs font-bold leading-[18px] text-white lg:static lg:ml-1.5">
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