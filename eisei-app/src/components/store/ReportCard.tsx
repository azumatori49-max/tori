import type { FC } from 'react';
import { StatusChip, statusFromCount, statusLabel } from '../ui/StatusChip';
import { formatDateTimeJa } from '../../lib/dateUtils';
import type { Submission } from '../../types';

interface Props {
  variant: 'daily' | 'weekly';
  title: string;
  description: string;
  submission: Submission | null;
  onOpen: () => void;
}

const VARIANT: Record<'daily' | 'weekly', { label: string; border: string; chip: string }> = {
  daily: {
    label: 'DAILY',
    border: 'border-l-accent',
    chip: 'bg-accent/10 text-accent',
  },
  weekly: {
    label: 'WEEKLY',
    border: 'border-l-blue-500',
    chip: 'bg-blue-50 text-blue-600',
  },
};

export const ReportCard: FC<Props> = ({ variant, title, description, submission, onOpen }) => {
  const v = VARIANT[variant];
  const count = submission?.count ?? 0;
  const target = 7;
  const status = statusFromCount(count, target);
  const pct = Math.min(100, (count / target) * 100);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition active:scale-[0.99] border-l-4 ${v.border}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest font-display ${v.chip}`}
        >
          {v.label}
        </span>
        <StatusChip kind={status}>{statusLabel(status)}</StatusChip>
      </div>
      <h3 className="mt-3 text-base font-bold">{title}</h3>
      <p className="mt-1 text-xs text-text-muted">{description}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-text-muted">提出枚数</span>
          <span>
            <span className="text-base">{count}</span> / {target} 枚
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className={`h-full rounded-full transition-all ${
              status === 'ok' ? 'bg-ok' : status === 'warn' ? 'bg-warn' : 'bg-border'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {submission && (
          <p className="mt-2 text-[11px] text-text-muted">
            最終提出: {formatDateTimeJa(submission.submittedAt)}
          </p>
        )}
      </div>
    </button>
  );
};
