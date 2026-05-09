interface Props {
  title: string;
  subtitle?: string;
  onLogout?: () => void;
  onBack?: () => void;
}

export const AppHeader = ({ title, subtitle, onLogout, onBack }: Props) => (
  <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
    {onBack ? (
      <button
        type="button"
        onClick={onBack}
        aria-label="戻る"
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-surface2"
      >
        ←
      </button>
    ) : (
      <img src="/logo.svg" alt="" className="h-9 w-9 rounded-full" />
    )}
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-bold text-ink">{title}</div>
      {subtitle && (
        <div className="truncate text-[11px] text-muted">{subtitle}</div>
      )}
    </div>
    {onLogout && (
      <button
        type="button"
        onClick={onLogout}
        className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted hover:bg-surface2"
      >
        ログアウト
      </button>
    )}
  </header>
);
