import type { ReactNode } from 'react';

export type Status = 'ok' | 'warn' | 'ng';

const CONFIG: Record<Status, { label: string; classes: string; dot: string }> = {
  ok: {
    label: '提出済み',
    classes: 'bg-ok-bg text-ok',
    dot: 'bg-ok',
  },
  warn: {
    label: '一部提出',
    classes: 'bg-warn-bg text-warn',
    dot: 'bg-warn',
  },
  ng: {
    label: '未提出',
    classes: 'bg-ng-bg text-ng',
    dot: 'bg-ng',
  },
};

interface Props {
  status: Status;
  label?: ReactNode;
  className?: string;
}

export const StatusChip = ({ status, label, className = '' }: Props) => {
  const cfg = CONFIG[status];
  return (
    <span className={`chip ${cfg.classes} ${className}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {label ?? cfg.label}
    </span>
  );
};

export const statusFromCount = (count: number, required = 7): Status => {
  if (count >= required) return 'ok';
  if (count > 0) return 'warn';
  return 'ng';
};
