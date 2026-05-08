import { computeStatus, StatusChip } from '../ui/StatusChip';
import { formatSubmittedAt } from '../../lib/dateUtils';
import { normalizePhotos } from '../../hooks/useSubmissions';
import type { ReportType, Submission } from '../../types';

interface Props {
  storeName: string;
  submission: Submission | null;
  reportType: ReportType;
  total: number;
  onClick: () => void;
}

export const StoreRow = ({ storeName, submission, total, onClick }: Props) => {
  const photos = normalizePhotos(submission?.photos, total);
  const count = submission?.count ?? photos.filter(Boolean).length;
  const status = computeStatus(count, total);

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
      <div
        className="grid gap-1 mb-2"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }).map((_, i) => {
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
        {submission?.submittedAt
          ? `提出: ${formatSubmittedAt(submission.submittedAt)}（${count}/${total}）`
          : '未提出'}
      </p>
    </button>
  );
};
