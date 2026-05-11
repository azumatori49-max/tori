interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onLogout?: () => void;
}

export const AppHeader = ({ title, subtitle, onBack, onLogout }: Props) => (
  <header className="sticky top-0 z-30 border-b border-border bg-surface px-4 py-3 shadow-sm">
    <div className="mx-auto flex max-w-app items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface2 text-lg text-text"
          aria-label="戻る"
        >
          ←
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold text-text">{title}</h1>
        {subtitle && <p className="truncate text-xs text-text-muted">{subtitle}</p>}
      </div>
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="shrink-0 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-bold text-text-muted active:bg-surface2"
        >
          ログアウト
        </button>
      )}
    </div>
  </header>
);
