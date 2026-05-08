import { computeStatus, StatusChip } from '../ui/StatusChip';
import type { ReportType } from '../../types';

interface Props {
  type: ReportType;
  title: string;
  description: string;
  count: number;
  total?: number;
  loading: boolean;
  onOpen: () => void;
}

const COLORS: Record<ReportType, { border: string; label: string; bar: string }> = {
  daily: {
    border: 'border-l-accent',
    label: 'bg-accent/10 text-accent',
    bar: 'bg-accent',
  },
  weekly: {
    border: 'border-l-blue-600',
    label: 'bg-blue-600/10 text-blue-700',
    bar: 'bg-blue-600',
  },
};

const TAG: Record<ReportType, string> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
};

export const ReportCard = ({
  type,
  title,
  description,
  count,
  total = 7,
  loading,
  onOpen,
}: Props) => {
  const status = computeStatus(count);
  const c = COLORS[type];
  const ratio = Math.min(count / total, 1);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full text-left bg-surface rounded-2xl border border-border ${c.border} border-l-4 p-4 shadow-sm active:scale-[0.99] transition`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full ${c.label}`}>
          {TAG[type]}
        </span>
        {!loading && <StatusChip status={status} />}
      </div>
      <h3 className="font-bold text-base mb-1">{title}</h3>
      <p className="text-xs text-text-muted mb-3 leading-relaxed">{description}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-surface2 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} transition-all`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums">
          {count} / {total}
        </span>
      </div>
    </button>
  );
};
