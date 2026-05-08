import { useEffect, useState } from 'react';
import { get, ref } from 'firebase/database';
import { db } from '../../lib/firebase';
import { Lightbox } from '../ui/Lightbox';
import { dateKeyToDate, formatSubmittedAt, getWeekKey } from '../../lib/dateUtils';
import type { StoreKey, Submission } from '../../types';

interface Props {
  open: boolean;
  storeKey: StoreKey | null;
  storeName: string | null;
  dateKey: string;
  onClose: () => void;
}

export const StoreDetailModal = ({ open, storeKey, storeName, dateKey, onClose }: Props) => {
  const [daily, setDaily] = useState<Submission | null>(null);
  const [weekly, setWeekly] = useState<Submission | null>(null);
  const [weekKeyLabel, setWeekKeyLabel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !storeKey) return;
    setLoading(true);
    const wk = getWeekKey(0, dateKeyToDate(dateKey));
    setWeekKeyLabel(wk);
    Promise.all([
      get(ref(db, `submissions/${storeKey}/daily/${dateKey}`)),
      get(ref(db, `submissions/${storeKey}/weekly/${wk}`)),
    ])
      .then(([d, w]) => {
        setDaily((d.val() as Submission | null) ?? null);
        setWeekly((w.val() as Submission | null) ?? null);
      })
      .finally(() => setLoading(false));
  }, [open, storeKey, dateKey]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-bg rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-bg border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-bold truncate">{storeName ?? '—'}</h2>
            <p className="text-xs text-text-muted">{dateKey}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center text-xl"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-4 space-y-5">
          {loading && <p className="text-center text-text-muted text-sm py-6">読み込み中...</p>}

          {!loading && (
            <>
              <Section
                label="DAILY"
                accent="text-accent"
                title="デイリー"
                submission={daily}
                onPhoto={setLightbox}
              />
              <Section
                label="WEEKLY"
                accent="text-blue-700"
                title={`ウィークリー（${weekKeyLabel}）`}
                submission={weekly}
                onPhoto={setLightbox}
              />
            </>
          )}
        </div>
      </div>

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
};

interface SectionProps {
  label: string;
  accent: string;
  title: string;
  submission: Submission | null;
  onPhoto: (url: string) => void;
}

const Section = ({ label, accent, title, submission, onPhoto }: SectionProps) => {
  const photos = submission?.photos ?? [];
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className={`text-[10px] font-black tracking-wider ${accent}`}>{label}</span>
          <h3 className="font-bold text-sm">{title}</h3>
        </div>
        {submission?.submittedAt && (
          <span className="text-[11px] text-text-muted">
            {formatSubmittedAt(submission.submittedAt)}
          </span>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="bg-surface2 rounded-xl py-6 text-center text-text-muted text-sm">
          未提出
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 7 }).map((_, i) => {
            const url = photos[i];
            return (
              <button
                type="button"
                key={i}
                onClick={() => url && onPhoto(url)}
                className="aspect-square rounded-lg overflow-hidden bg-surface2 border border-border active:scale-95"
                disabled={!url}
              >
                {url ? (
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-text-muted/60 text-[10px]">
                    —
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
