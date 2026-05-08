interface Props {
  title: string;
  subtitle?: string;
  onLogout?: () => void;
  onBack?: () => void;
}

export const AppHeader = ({ title, subtitle, onLogout, onBack }: Props) => (
  <header className="sticky top-0 z-30 bg-surface border-b border-border">
    <div className="max-w-screen-sm mx-auto px-4 py-3 flex items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 -ml-2 rounded-full hover:bg-surface2 flex items-center justify-center text-xl"
          aria-label="戻る"
        >
          ←
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-bold text-base truncate">{title}</h1>
        {subtitle && <p className="text-xs text-text-muted truncate">{subtitle}</p>}
      </div>
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="text-xs font-bold text-text-muted px-3 py-1.5 rounded-full bg-surface2 hover:bg-border"
        >
          ログアウト
        </button>
      )}
    </div>
  </header>
);
