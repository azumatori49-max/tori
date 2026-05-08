import { useEffect, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { DashboardTab } from './DashboardTab';
import { StoreManageTab } from './StoreManageTab';
import { formatDateJa } from '../../lib/dateUtils';
import { maybeRunDailyCleanup } from '../../lib/cleanup';
import type { AdminTab, Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
  onLogout: () => void;
}

export const AdminScreen: FC<Props> = ({ stores, onLogout }) => {
  const [tab, setTab] = useState<AdminTab>('dashboard');

  // 90日経過した提出データを1日1回まとめて削除（管理者ログイン時に走る）
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
        {tab === 'dashboard' ? (
          <DashboardTab stores={stores} />
        ) : (
          <StoreManageTab stores={stores} />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-app grid-cols-2">
          {(
            [
              { key: 'dashboard', icon: '📋', label: '提出確認' },
              { key: 'stores', icon: '🏪', label: '店舗管理' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition ${
                tab === item.key ? 'text-accent' : 'text-text-muted'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
