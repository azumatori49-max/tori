import { computeStatus, StatusChip } from '../ui/StatusChip';
import { formatSubmittedAt } from '../../lib/dateUtils';
import type { Submission } from '../../types';

interface Props {
  storeName: string;
  submission: Submission | null;
  onClick: () => void;
}

export const StoreRow = ({ storeName, submission, onClick }: Props) => {
  const count = submission?.count ?? 0;
  const status = computeStatus(count);
  const photos = submission?.photos ?? [];

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-surface border border-border rounded-2xl p-3 active:scale-[0.99] transition shadow-sm"
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="font-bold text-sm truncate">{storeName}</h3>
        <StatusChip status={status} />
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {Array.from({ length: 7 }).map((_, i) => {
          const url = photos[i];
          return (
            <div
              key={i}
              className="aspect-square rounded-md overflow-hidden bg-surface2 border border-border"
            >
              {url ? (
                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted/60 text-[10px]">
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-text-muted">
        {submission?.submittedAt ? `提出: ${formatSubmittedAt(submission.submittedAt)}` : '未提出'}
      </p>
    </button>
  );
};
