import { useEffect, useMemo, useState } from 'react';
import { Lightbox } from '../ui/Lightbox';
import { StatusChip, statusFromCount } from '../ui/StatusChip';
import { formatTimestampJa, getWeekKeyFromDate, dateKeyToDate } from '../../lib/dateUtils';
import { useSubmissionFor } from '../../hooks/useSubmissions';
import type { StoreKey } from '../../types';

interface Props {
  open: boolean;
  storeKey: StoreKey | null;
  storeName: string;
  dateKey: string;
  onClose: () => void;
}

const PHOTO_GRID = 'grid grid-cols-4 gap-2';

const PhotoGrid = ({
  photos,
  onSelect,
}: {
  photos: string[];
  onSelect: (url: string) => void;
}) =>
  photos.length === 0 ? (
    <p className="text-xs text-text-muted py-4 text-center">写真はまだ提出されていません</p>
  ) : (
    <div className={PHOTO_GRID}>
      {photos.map((url, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(url)}
          className="aspect-square rounded-lg overflow-hidden bg-surface2 active:scale-[0.97] transition"
        >
          <img src={url} alt={`写真 ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );

export const StoreDetailModal = ({ open, storeKey, storeName, dateKey, onClose }: Props) => {
  const weekKey = useMemo(
    () => (dateKey ? getWeekKeyFromDate(dateKeyToDate(dateKey)) : ''),
    [dateKey],
  );

  const daily = useSubmissionFor(open ? storeKey : null, 'daily', dateKey);
  const weekly = useSubmissionFor(open ? storeKey : null, 'weekly', weekKey);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setLightboxSrc(null);
  }, [open]);

  if (!open) return null;

  const dailyCount = daily.submission?.count ?? 0;
  const weeklyCount = weekly.submission?.count ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-end animate-fadeIn">
      <button
        type="button"
        aria-label="閉じる"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full mx-auto max-w-app bg-bg rounded-t-3xl shadow-2xl animate-slideUp max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border bg-surface rounded-t-3xl">
          <div className="min-w-0">
            <p className="text-[10px] tracking-widest font-mono text-text-muted">STORE DETAIL</p>
            <h2 className="font-display text-lg font-extrabold truncate">{storeName}</h2>
            <p className="text-[11px] text-text-muted">{dateKey}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface2 hover:bg-border transition flex items-center justify-center text-base"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <section>
            <header className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-widest text-text-muted">
                  DAILY
                </span>
                <span className="font-bold">デイリー</span>
              </div>
              {daily.loading ? (
                <span className="chip bg-surface2 text-text-muted">読込中</span>
              ) : (
                <StatusChip status={statusFromCount(dailyCount, 7)} label={`${dailyCount}/7`} />
              )}
            </header>
            <PhotoGrid photos={daily.submission?.photos ?? []} onSelect={setLightboxSrc} />
            {daily.submission?.submittedAt ? (
              <p className="text-[11px] text-text-muted mt-2">
                提出: {formatTimestampJa(daily.submission.submittedAt)}
              </p>
            ) : null}
          </section>

          <section>
            <header className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-widest text-text-muted">
                  WEEKLY
                </span>
                <span className="font-bold">ウィークリー（同週）</span>
              </div>
              {weekly.loading ? (
                <span className="chip bg-surface2 text-text-muted">読込中</span>
              ) : (
                <StatusChip status={statusFromCount(weeklyCount, 7)} label={`${weeklyCount}/7`} />
              )}
            </header>
            <PhotoGrid photos={weekly.submission?.photos ?? []} onSelect={setLightboxSrc} />
            {weekly.submission?.submittedAt ? (
              <p className="text-[11px] text-text-muted mt-2">
                提出: {formatTimestampJa(weekly.submission.submittedAt)}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  );
};
