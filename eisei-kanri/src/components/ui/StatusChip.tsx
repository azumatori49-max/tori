import type { SubmissionStatus } from '../../types';

interface Props {
  status: SubmissionStatus;
  className?: string;
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

export const StatusChip = ({ status, className = '' }: Props) => (
  <span
    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${CLASSES[status]} ${className}`}
  >
    {LABELS[status]}
  </span>
);

export const computeStatus = (count: number): SubmissionStatus => {
  if (count >= 7) return 'submitted';
  if (count > 0) return 'partial';
  return 'none';
};
