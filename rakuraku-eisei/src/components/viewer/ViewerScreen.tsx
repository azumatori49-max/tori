import { useStores } from '../../hooks/useStores';
import { formatDateJa } from '../../lib/dateUtils';
import { DashboardTab } from '../admin/DashboardTab';

interface Props {
  onLogout: () => void;
}

/**
 * 閲覧専用ページ（/view）。
 * 管理者の提出確認と同じ画面だが、見るだけ（サーバー側ルールでも書き込み不可）。
 */
export const ViewerScreen = ({ onLogout }: Props) => {
  const { stores, loading } = useStores();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-app items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-text">提出状況</h1>
              <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-bold text-text-muted">
                閲覧専用
              </span>
            </div>
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
        ) : (
          <DashboardTab stores={stores} />
        )}
      </main>
    </div>
  );
};
