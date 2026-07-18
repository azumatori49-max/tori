import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { withRetry } from '../../lib/retry';
import type { StoreKey, Submission } from '../../types';
import { formatSubmittedAt, getWeekKeyFromDate, parseDateKey, parseWeekKey } from '../../lib/dateUtils';
import { Lightbox } from '../ui/Lightbox';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  reportTab: 'daily' | 'weekly';
  selectedKey: string;
  onClose: () => void;
}

export const StoreDetailModal = ({
  storeKey,
  storeName,
  reportTab,
  selectedKey,
  onClose,
}: Props) => {
  const [daily, setDaily] = useState<Submission | null>(null);
  const [weekly, setWeekly] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const dateKey =
        reportTab === 'daily' ? selectedKey : (() => {
          const base = parseWeekKey(selectedKey);
          return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
        })();
      const dailyDate = reportTab === 'daily' ? parseDateKey(selectedKey) : parseWeekKey(selectedKey);
      const weekKey = reportTab === 'weekly' ? selectedKey : getWeekKeyFromDate(dailyDate);

      const [dailySnap, weeklySnap] = await Promise.all([
        withRetry(() => getDoc(doc(db, 'submissions', storeKey, 'daily', dateKey))).catch(() => null),
        withRetry(() => getDoc(doc(db, 'submissions', storeKey, 'weekly', weekKey))).catch(() => null),
      ]);
      if (cancelled) return;
      setDaily(dailySnap?.exists() ? (dailySnap.data() as Submission) : null);
      setWeekly(weeklySnap?.exists() ? (weeklySnap.data() as Submission) : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeKey, reportTab, selectedKey]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/40" onClick={onClose}>
      <div className="mt-auto flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-bg animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-text">{storeName}</h2>
            <p className="text-xs text-text-muted">{selectedKey}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-lg"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {loading ? (
            <div className="text-center text-sm text-text-muted py-8">読み込み中…</div>
          ) : (
            <>
              <Section
                title="デイリー写真"
                color="text-accent"
                submission={daily}
                onTap={setLightbox}
              />
              <Section
                title="ウィークリー写真（同じ週）"
                color="text-accent-deep"
                submission={weekly}
                onTap={setLightbox}
              />
            </>
          )}
        </div>
      </div>
      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
};

const Section = ({
  title,
  color,
  submission,
  onTap,
}: {
  title: string;
  color: string;
  submission: Submission | null;
  onTap: (url: string) => void;
}) => (
  <section>
    <div className="mb-2 flex items-center justify-between">
      <h3 className={`text-sm font-black tracking-wide ${color}`}>{title}</h3>
      <span className="text-xs text-text-muted">{submission?.count ?? 0} / 7</span>
    </div>
    <div className="grid grid-cols-4 gap-1.5">
      {Array.from({ length: 7 }).map((_, i) => {
        const url = submission?.photos?.[i];
        return (
          <button
            key={i}
            type="button"
            onClick={() => url && onTap(url)}
            disabled={!url}
            className="aspect-square overflow-hidden rounded-md border border-border bg-surface2"
          >
            {url ? (
              <img src={url} alt={`#${i + 1}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                #{i + 1}
              </div>
            )}
          </button>
        );
      })}
    </div>
    {submission && (
      <p className="mt-2 text-[11px] text-text-muted">
        提出: {formatSubmittedAt(submission.submittedAt)}
      </p>
    )}
  </section>
);
