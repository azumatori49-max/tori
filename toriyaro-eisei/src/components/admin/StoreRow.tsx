import { StatusChip, statusFromCount } from '../ui/StatusChip';
import { formatTimestampJa } from '../../lib/dateUtils';
import type { Submission } from '../../types';

interface Props {
  storeName: string;
  submission: Submission | null;
  loading?: boolean;
  required: number;
  onClick: () => void;
}

export const StoreRow = ({ storeName, submission, loading, required, onClick }: Props) => {
  const count = submission?.count ?? 0;
  const status = statusFromCount(count, required);
  const photos = submission?.photos ?? [];
  const PLACEHOLDERS = Array.from({ length: Math.max(7, photos.length) });

  return (
    <button
      type="button"
      onClick={onClick}
      className="card w-full text-left p-4 flex flex-col gap-3 transition active:scale-[0.99] hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-display text-base font-extrabold leading-tight truncate">
          {storeName}
        </span>
        {loading ? (
          <span className="chip bg-surface2 text-text-muted">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-text-muted animate-pulseDot" />
            読込中
          </span>
        ) : (
          <StatusChip status={status} label={`${count}/${required}`} />
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {PLACEHOLDERS.map((_, i) => {
          const url = photos[i];
          return (
            <div
              key={i}
              className={`aspect-square rounded-md overflow-hidden ${
                url ? 'bg-surface2' : 'bg-surface2 border border-dashed border-border'
              }`}
            >
              {url ? (
                <img
                  src={url}
                  alt={`${storeName} ${i + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {submission?.submittedAt ? (
        <p className="text-[11px] text-text-muted">
          提出: {formatTimestampJa(submission.submittedAt)}
        </p>
      ) : (
        <p className="text-[11px] text-text-muted">未提出</p>
      )}
    </button>
  );
};
