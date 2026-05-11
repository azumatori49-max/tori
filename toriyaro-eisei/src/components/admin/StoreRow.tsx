import type { Submission } from '../../types';
import { getStatus } from '../../types';
import { StatusChip } from '../ui/StatusChip';
import { formatSubmittedAt } from '../../lib/dateUtils';

interface Props {
  storeName: string;
  submission: Submission | null;
  onClick: () => void;
}

export const StoreRow = ({ storeName, submission, onClick }: Props) => {
  const count = submission?.count ?? 0;
  const status = getStatus(count);

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-xl border border-border bg-surface p-3 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-bold text-text">{storeName}</h3>
        <StatusChip status={status} count={count} />
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => {
          const url = submission?.photos?.[i];
          return (
            <div
              key={i}
              className="aspect-square overflow-hidden rounded-md border border-border bg-surface2"
            >
              {url ? (
                <img src={url} alt={`#${i + 1}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-text-muted">
                  #{i + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {submission && (
        <p className="mt-2 text-[11px] text-text-muted">
          提出: {formatSubmittedAt(submission.submittedAt)}
        </p>
      )}
    </button>
  );
};
