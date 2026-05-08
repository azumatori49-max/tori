import type { FC } from 'react';

export type StatusKind = 'ok' | 'warn' | 'ng' | 'muted';

const STYLES: Record<StatusKind, string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  ng: 'bg-ng-bg text-ng',
  muted: 'bg-surface2 text-text-muted',
};

interface Props {
  kind: StatusKind;
  children: React.ReactNode;
  className?: string;
}

export const StatusChip: FC<Props> = ({ kind, children, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${STYLES[kind]} ${className}`}
  >
    {children}
  </span>
);

export const statusFromCount = (count: number, target = 7): StatusKind => {
  if (count >= target) return 'ok';
  if (count > 0) return 'warn';
  return 'ng';
};

export const statusLabel = (kind: StatusKind): string => {
  switch (kind) {
    case 'ok':
      return '提出済み';
    case 'warn':
      return '一部提出';
    case 'ng':
      return '未提出';
    case 'muted':
      return '—';
  }
};
