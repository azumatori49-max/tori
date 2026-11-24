import type { FC, ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  showLogo?: boolean;
  /** true のとき、PC（1024px以上）では本文と同じ広い幅にそろえる（管理画面用） */
  wide?: boolean;
}

export const AppHeader: FC<Props> = ({ title, subtitle, left, right, showLogo, wide }) => (
  <header className="app-header sticky z-30 border-b border-border bg-surface/95 backdrop-blur">
    <div className={`mx-auto flex h-14 w-full max-w-app items-center gap-2 px-3 ${wide ? 'lg:max-w-[1200px] lg:px-6' : ''}`}>
      {/* 左右どちらかに「ご意見」ボタン（画面に固定表示）が重なるので、中身が無い側はその幅を空けておく */}
      <div className={`flex shrink-0 items-center ${left ? 'min-w-[44px]' : 'w-[72px]'}`}>{left}</div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center">
        {showLogo && (
          <img src="/rakuraku.png" alt="らくらく衛生管理" className="hidden h-8 w-8 shrink-0 rounded-full object-cover min-[360px]:block" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold leading-tight">{title}</h1>
          {subtitle && (
            <p className="truncate text-[11px] text-text-muted leading-tight">{subtitle}</p>
          )}
        </div>
      </div>
      <div className={`flex shrink-0 items-center justify-end ${right ? 'min-w-[44px]' : 'w-[72px]'}`}>{right}</div>
    </div>
  </header>
);
