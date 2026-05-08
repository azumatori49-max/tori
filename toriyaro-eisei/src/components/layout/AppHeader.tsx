import type { FC, ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  showLogo?: boolean;
}

export const AppHeader: FC<Props> = ({ title, subtitle, left, right, showLogo }) => (
  <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
    <div className="mx-auto flex h-14 w-full max-w-app items-center gap-3 px-4">
      <div className="flex w-10 items-center">{left}</div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center">
        {showLogo && (
          <img src="/logo.png" alt="鶏ヤロー" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold leading-tight">{title}</h1>
          {subtitle && (
            <p className="truncate text-[11px] text-text-muted leading-tight">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex w-10 items-center justify-end">{right}</div>
    </div>
  </header>
);
