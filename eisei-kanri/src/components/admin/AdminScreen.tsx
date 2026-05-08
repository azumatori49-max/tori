import { useMemo, useState } from 'react';
import { AdminNav } from '../layout/AdminNav';
import { DashboardTab } from './DashboardTab';
import { StoreManageTab } from './StoreManageTab';
import { formatDateJa } from '../../lib/dateUtils';
import type { AdminTab } from '../../types';
import type { StoreMap } from '../../hooks/useStores';

interface Props {
  stores: StoreMap;
  onLogout: () => void;
}

export const AdminScreen = ({ stores, onLogout }: Props) => {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const today = useMemo(() => formatDateJa(new Date()), []);

  return (
    <div className="min-h-full flex flex-col pb-20">
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-screen-sm mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base">管理者ダッシュボード</h1>
            <p className="text-xs text-text-muted">{today}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs font-bold text-text-muted px-3 py-1.5 rounded-full bg-surface2 hover:bg-border"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-screen-sm w-full mx-auto px-4 py-4">
        {tab === 'dashboard' && <DashboardTab stores={stores} />}
        {tab === 'stores' && <StoreManageTab stores={stores} />}
      </main>

      <AdminNav active={tab} onChange={setTab} />
    </div>
  );
};
