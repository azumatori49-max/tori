import type { FC } from 'react';
import { StatusChip, statusFromCount, statusLabel } from '../ui/StatusChip';
import { formatDateTimeJa } from '../../lib/dateUtils';
import type { Submission } from '../../types';

interface Props {
  storeName: string;
  submission: Submission | null;
  onClick: () => void;
}

export const StoreRow: FC<Props> = ({ storeName, submission, onClick }) => {
  const count = submission?.count ?? 0;
  const status = statusFromCount(count, 7);
  const photos = submission?.photos ?? [];

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-bold">{storeName}</h3>
        <StatusChip kind={status}>{statusLabel(status)}</StatusChip>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        {Array.from({ length: 7 }).map((_, i) => {
          const url = photos[i];
          return (
            <div
              key={i}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border ${
                url ? 'border-border' : 'border-dashed border-border bg-surface2'
              }`}
            >
              {url ? (
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-text-muted">
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>

      {submission ? (
        <p className="mt-2 text-[11px] text-text-muted">
          提出: {formatDateTimeJa(submission.submittedAt)}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-ng">未提出</p>
      )}
    </button>
  );
};
