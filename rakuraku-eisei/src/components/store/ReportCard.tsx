import type { ReportType, Submission } from '../../types';
import { getStatus } from '../../types';
import { StatusChip } from '../ui/StatusChip';
import { formatSubmittedAt } from '../../lib/dateUtils';

interface Props {
  type: ReportType;
  submission: Submission | null;
  onStart: () => void;
}

const META: Record<ReportType, { label: string; title: string; desc: string; ring: string; chipBg: string; chipColor: string }> = {
  daily: {
    label: 'DAILY',
    title: '毎日の衛生チェック',
    desc: '指定の7箇所を撮影して提出',
    ring: 'border-l-accent',
    chipBg: 'bg-accent/10',
    chipColor: 'text-accent',
  },
  weekly: {
    label: 'WEEKLY',
    title: '週1回の衛生チェック',
    desc: '今週中に7箇所を撮影して提出',
    ring: 'border-l-blue-600',
    chipBg: 'bg-blue-50',
    chipColor: 'text-blue-700',
  },
};

export const ReportCard = ({ type, submission, onStart }: Props) => {
  const meta = META[type];
  const count = submission?.count ?? 0;
  const status = getStatus(count);
  const pct = Math.min(100, (count / 7) * 100);
  const barColor =
    status === 'submitted' ? 'bg-ok' : status === 'partial' ? 'bg-warn' : 'bg-ng';

  return (
    <button
      type="button"
      onClick={onStart}
      className={`w-full rounded-2xl border border-border border-l-[6px] ${meta.ring} bg-surface p-4 text-left shadow-sm transition active:scale-[0.99]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-block rounded-full ${meta.chipBg} ${meta.chipColor} px-2 py-0.5 text-[10px] font-black tracking-widest`}
          >
            {meta.label}
          </span>
          <h2 className="mt-2 text-base font-bold text-text">{meta.title}</h2>
          <p className="mt-0.5 text-xs text-text-muted">{meta.desc}</p>
        </div>
        <StatusChip status={status} count={count} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
          <span>進捗</span>
          <span className="font-bold text-text">{count} / 7枚</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface2">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {submission && (
          <p className="mt-2 text-[11px] text-text-muted">
            最終提出: {formatSubmittedAt(submission.submittedAt)}
          </p>
        )}
      </div>
    </button>
  );
};
