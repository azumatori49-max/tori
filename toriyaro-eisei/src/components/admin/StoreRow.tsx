import { StatusChip } from "../ui/StatusChip";
import { formatDateTimeJa } from "../../lib/dateUtils";
import type { Submission } from "../../types";

interface Props {
  storeName: string;
  submission: Submission | null;
  onOpen: () => void;
}

export const StoreRow = ({ storeName, submission, onOpen }: Props) => {
  const count = submission?.count ?? 0;
  const photos = submission?.photos ?? [];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full rounded-2xl border border-border bg-surface p-3 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-bold text-ink">{storeName}</span>
        <StatusChip count={count} />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => {
          const url = photos[i];
          return (
            <div
              key={i}
              className="relative aspect-square overflow-hidden rounded-md bg-surface2"
            >
              {url ? (
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
                  -
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[11px] text-muted">
        {submission
          ? `提出: ${formatDateTimeJa(submission.submittedAt)}`
          : "未提出"}
      </div>
    </button>
  );
};
