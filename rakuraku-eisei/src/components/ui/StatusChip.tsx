import type { SubmissionStatus } from '../../types';

interface Props {
  status: SubmissionStatus;
  count?: number;
}

const LABELS: Record<SubmissionStatus, string> = {
  submitted: '提出済み',
  partial: '一部提出',
  none: '未提出',
};

const CLASSES: Record<SubmissionStatus, string> = {
  submitted: 'bg-ok-bg text-ok',
  partial: 'bg-warn-bg text-warn',
  none: 'bg-ng-bg text-ng',
};

export const StatusChip = ({ status, count }: Props) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${CLASSES[status]}`}
  >
    {LABELS[status]}
    {typeof count === 'number' && status !== 'submitted' && status !== 'none' && (
      <span className="opacity-70"> {count}/7</span>
    )}
  </span>
);
