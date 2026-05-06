import type { ReactNode } from 'react';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  sticky?: boolean;
  variant?: 'default' | 'accent';
}

export const AppHeader = ({
  title,
  subtitle,
  leading,
  trailing,
  sticky = true,
  variant = 'default',
}: Props) => {
  const bg =
    variant === 'accent'
      ? 'bg-accent text-white border-accent'
      : 'bg-surface/95 backdrop-blur text-text border-border';
  return (
    <header
      className={`${sticky ? 'sticky top-0 z-30' : ''} ${bg} border-b px-4 py-3 flex items-center gap-3`}
    >
      {leading ? <div className="flex-shrink-0">{leading}</div> : null}
      <div className="flex-1 min-w-0">
        <h1 className="font-display text-base font-extrabold tracking-wide truncate">{title}</h1>
        {subtitle ? <p className="text-[11px] opacity-70 truncate">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="flex-shrink-0">{trailing}</div> : null}
    </header>
  );
};
