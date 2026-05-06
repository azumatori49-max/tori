import { useState } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { AdminNav } from '../layout/AdminNav';
import { useStores } from '../../hooks/useStores';
import { formatDateJa } from '../../lib/dateUtils';
import type { AdminTab } from '../../types';
import { DashboardTab } from './DashboardTab';
import { StoreManageTab } from './StoreManageTab';

interface Props {
  onLogout: () => void;
}

export const AdminScreen = ({ onLogout }: Props) => {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const { stores, loading } = useStores();
  const today = new Date();

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <AppHeader
        title="管理者ダッシュボード"
        subtitle={formatDateJa(today)}
        variant="accent"
        trailing={
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl bg-white/15 text-white text-xs font-bold hover:bg-white/25 transition"
          >
            ログアウト
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center text-text-muted text-sm py-10">読み込み中…</p>
        ) : tab === 'dashboard' ? (
          <DashboardTab stores={stores} />
        ) : (
          <StoreManageTab stores={stores} />
        )}
      </main>

      <AdminNav active={tab} onChange={setTab} />
    </div>
  );
};
