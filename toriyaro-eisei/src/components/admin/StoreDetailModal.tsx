import { useEffect, useMemo, useState } from 'react';
import { Lightbox } from '../ui/Lightbox';
import { StatusChip, statusFromCount } from '../ui/StatusChip';
import { formatTimestampJa, getWeekKeyFromDate, dateKeyToDate } from '../../lib/dateUtils';
import { useSubmissionFor } from '../../hooks/useSubmissions';
import { slotCountFor, slotIsPhoto, slotLabelFor } from '../../data/slotLabels';
import type { ReportType, StoreKey, Submission } from '../../types';

interface Props {
  open: boolean;
  storeKey: StoreKey | null;
  storeName: string;
  dateKey: string;
  onClose: () => void;
}

const PHOTO_GRID = 'grid grid-cols-4 gap-2';

const SlotGrid = ({
  type,
  submission,
  onSelect,
}: {
  type: ReportType;
  submission: Submission | null;
  onSelect: (url: string) => void;
}) => {
  const total = slotCountFor(type);
  const photos = submission?.photos ?? [];
  const checks = submission?.checks ?? {};
  if (!submission) {
    return <p className="text-xs text-text-muted py-4 text-center">提出はまだありません</p>;
  }
  return (
    <div className={PHOTO_GRID}>
      {Array.from({ length: total }).map((_, i) => {
        const label = slotLabelFor(type, i);
        const isPhoto = slotIsPhoto(type, i);
        const url = photos[i];
        const checkedAt = checks[String(i)];
        return (
          <div key={i} className="flex flex-col gap-1">
            {isPhoto ? (
              url ? (
                <button
                  type="button"
                  onClick={() => onSelect(url)}
                  className="aspect-square rounded-lg overflow-hidden bg-surface2 active:scale-[0.97] transition"
                >
                  <img
                    src={url}
                    alt={label}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="aspect-square rounded-lg bg-surface2 border border-dashed border-border flex items-center justify-center text-text-muted text-[10px]">
                  未提出
                </div>
              )
            ) : checkedAt ? (
              <div className="aspect-square rounded-lg bg-ok-bg border border-ok/30 flex flex-col items-center justify-center text-ok gap-0.5">
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="5 12.5 10 17.5 19 7.5" />
                </svg>
                <span className="text-[9px] font-bold tracking-wider">確認済み</span>
              </div>
            ) : (
              <div className="aspect-square rounded-lg bg-surface2 border border-dashed border-border flex items-center justify-center text-text-muted text-[10px]">
                未確認
              </div>
            )}
            <span className="text-[9px] leading-tight font-bold text-text-muted text-center break-keep">
              {label}
            </span>
            {!isPhoto && checkedAt ? (
              <span className="text-[8px] leading-tight text-text-muted text-center font-mono">
                {formatTimestampJa(checkedAt)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

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
  const dailyTotal = slotCountFor('daily');
  const weeklyTotal = slotCountFor('weekly');

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
            ×
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
                <StatusChip
                  status={statusFromCount(dailyCount, dailyTotal)}
                  label={`${dailyCount}/${dailyTotal}`}
                />
              )}
            </header>
            <SlotGrid type="daily" submission={daily.submission} onSelect={setLightboxSrc} />
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
                <StatusChip
                  status={statusFromCount(weeklyCount, weeklyTotal)}
                  label={`${weeklyCount}/${weeklyTotal}`}
                />
              )}
            </header>
            <SlotGrid type="weekly" submission={weekly.submission} onSelect={setLightboxSrc} />
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
