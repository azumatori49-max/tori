import { useState } from 'react';
import { useStores } from '../../hooks/useStores';
import { formatDateJa } from '../../lib/dateUtils';
import type { AdminTab } from '../../types';
import { AdminNav } from '../layout/AdminNav';
import { DashboardTab } from './DashboardTab';
import { ItemsTab } from './ItemsTab';
import { StoreManageTab } from './StoreManageTab';

interface Props {
  onLogout: () => void;
}

export const AdminScreen = ({ onLogout }: Props) => {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const { stores, loading, addStore, deleteStore, bulkImport } = useStores();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-app items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-text">管理者ダッシュボード</h1>
            <p className="truncate text-xs text-text-muted">{formatDateJa(new Date())}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-muted active:bg-surface2"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-app flex-1">
        {loading ? (
          <div className="py-8 text-center text-sm text-text-muted">読み込み中…</div>
        ) : tab === 'dashboard' ? (
          <DashboardTab stores={stores} />
        ) : tab === 'items' ? (
          <ItemsTab />
        ) : (
          <StoreManageTab
            stores={stores}
            onAddStore={addStore}
            onDeleteStore={deleteStore}
            onBulkImport={bulkImport}
          />
        )}
      </main>

      <div className="mx-auto w-full max-w-app">
        <AdminNav tab={tab} onChange={setTab} />
      </div>
    </div>
  );
};
