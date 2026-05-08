import { useEffect, useState, type FC } from 'react';
import { Lightbox } from '../ui/Lightbox';
import { fetchSubmissionsForKey } from '../../hooks/useSubmissions';
import { dateKeyToDate, formatDateTimeJa, getWeekKey } from '../../lib/dateUtils';
import type { StoreKey, Submission } from '../../types';

interface Props {
  open: boolean;
  storeKey: StoreKey | null;
  storeName: string;
  /** Plain date string YYYY-MM-DD that anchors the displayed period. */
  anchorDateKey: string;
  onClose: () => void;
}

interface LoadedData {
  daily: Submission | null;
  weekly: Submission | null;
}

export const StoreDetailModal: FC<Props> = ({
  open,
  storeKey,
  storeName,
  anchorDateKey,
  onClose,
}) => {
  const [data, setData] = useState<LoadedData>({ daily: null, weekly: null });
  const [loading, setLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !storeKey) return;
    let cancelled = false;
    setLoading(true);
    const dailyKey = anchorDateKey;
    const weekKey = getWeekKey(0, dateKeyToDate(anchorDateKey));
    Promise.all([
      fetchSubmissionsForKey([storeKey], 'daily', dailyKey),
      fetchSubmissionsForKey([storeKey], 'weekly', weekKey),
    ])
      .then(([d, w]) => {
        if (!cancelled) {
          setData({ daily: d[storeKey] ?? null, weekly: w[storeKey] ?? null });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, storeKey, anchorDateKey]);

  if (!open) return null;

  const sectionPhotos = (sub: Submission | null) => sub?.photos ?? [];

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40 animate-fadeIn" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-surface shadow-2xl animate-slideUp">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{storeName}</h2>
            <p className="text-[11px] text-text-muted">{anchorDateKey}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-text-muted hover:text-accent"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {loading && <p className="text-center text-sm text-text-muted">読み込み中…</p>}
          {!loading && (
            <>
              <Section
                label="DAILY"
                color="text-accent"
                bg="bg-accent/10"
                submission={data.daily}
                photos={sectionPhotos(data.daily)}
                onPhotoClick={setLightboxUrl}
              />
              <Section
                label="WEEKLY"
                color="text-blue-600"
                bg="bg-blue-50"
                submission={data.weekly}
                photos={sectionPhotos(data.weekly)}
                onPhotoClick={setLightboxUrl}
              />
            </>
          )}
        </div>
      </div>

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
};

interface SectionProps {
  label: string;
  color: string;
  bg: string;
  submission: Submission | null;
  photos: string[];
  onPhotoClick: (url: string) => void;
}

const Section: FC<SectionProps> = ({ label, color, bg, submission, photos, onPhotoClick }) => (
  <section>
    <div className="mb-2 flex items-center justify-between">
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest font-display ${bg} ${color}`}
      >
        {label}
      </span>
      <span className="text-xs font-bold">{photos.length} / 7枚</span>
    </div>
    {submission ? (
      <p className="mb-2 text-[11px] text-text-muted">
        提出: {formatDateTimeJa(submission.submittedAt)}
      </p>
    ) : (
      <p className="mb-2 text-[11px] text-ng">未提出</p>
    )}
    <div className="grid grid-cols-4 gap-1.5">
      {Array.from({ length: 7 }).map((_, i) => {
        const url = photos[i];
        return (
          <button
            key={i}
            type="button"
            disabled={!url}
            onClick={() => url && onPhotoClick(url)}
            className={`relative aspect-square overflow-hidden rounded-md border ${
              url ? 'border-border' : 'border-dashed border-border bg-surface2'
            }`}
          >
            {url ? (
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[11px] text-text-muted">
                {i + 1}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </section>
);
