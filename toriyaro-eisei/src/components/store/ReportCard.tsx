import { StatusChip, statusFromCount } from '../ui/StatusChip';
import type { ReportType } from '../../types';
import { formatTimestampJa } from '../../lib/dateUtils';

interface Props {
  type: ReportType;
  count: number;
  required: number;
  loading?: boolean;
  submittedAt?: string;
  onOpen: () => void;
}

const META: Record<
  ReportType,
  { label: string; title: string; description: string; accent: string; bar: string }
> = {
  daily: {
    label: 'DAILY',
    title: 'デイリー衛生チェック',
    description: '毎日撮影する7枚の衛生確認写真',
    accent: 'border-l-accent',
    bar: 'bg-accent',
  },
  weekly: {
    label: 'WEEKLY',
    title: 'ウィークリー衛生チェック',
    description: '週1回撮影する7枚の衛生確認写真',
    accent: 'border-l-blue-500',
    bar: 'bg-blue-500',
  },
};

export const ReportCard = ({
  type,
  count,
  required,
  loading,
  submittedAt,
  onOpen,
}: Props) => {
  const meta = META[type];
  const ratio = Math.min(count / required, 1);
  const status = statusFromCount(count, required);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`card text-left w-full p-5 border-l-4 ${meta.accent} flex flex-col gap-4 transition active:scale-[0.99] hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] tracking-widest text-text-muted">
            {meta.label}
          </span>
          <h2 className="font-display text-lg font-extrabold leading-tight mt-0.5">
            {meta.title}
          </h2>
          <p className="text-xs text-text-muted mt-1">{meta.description}</p>
        </div>
        {loading ? (
          <span className="chip bg-surface2 text-text-muted">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted animate-pulseDot" />
            読込中
          </span>
        ) : (
          <StatusChip status={status} />
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs text-text-muted">進捗</span>
          <span className="font-mono text-sm font-bold tabular-nums">
            {count}<span className="text-text-muted"> / {required}</span>
          </span>
        </div>
        <div className="h-2 bg-surface2 rounded-full overflow-hidden">
          <div
            className={`h-full ${meta.bar} transition-all`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </div>

      {submittedAt ? (
        <p className="text-[11px] text-text-muted">最終提出: {formatTimestampJa(submittedAt)}</p>
      ) : null}
    </button>
  );
};
