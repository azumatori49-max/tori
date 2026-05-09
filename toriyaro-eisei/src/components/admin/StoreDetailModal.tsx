import { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { db } from "../../lib/firebase";
import type { StoreKey, Submission } from "../../types";
import { Lightbox } from "../ui/Lightbox";
import { formatDateTimeJa } from "../../lib/dateUtils";

interface Props {
  storeKey: StoreKey;
  storeName: string;
  dailyKey: string;
  weeklyKey: string;
  onClose: () => void;
}

const Grid = ({
  title,
  submission,
  onPick,
}: {
  title: string;
  submission: Submission | null;
  onPick: (url: string) => void;
}) => (
  <section className="mb-5">
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <span className="font-mono text-xs text-muted">
        {submission?.count ?? 0}/7
      </span>
    </div>
    {submission ? (
      <>
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const url = submission.photos[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => url && onPick(url)}
                className="relative aspect-square overflow-hidden rounded-lg bg-surface2"
                disabled={!url}
              >
                {url ? (
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                    {i + 1}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          提出: {formatDateTimeJa(submission.submittedAt)}
        </p>
      </>
    ) : (
      <p className="rounded-lg bg-ng-bg px-3 py-3 text-xs text-ng">未提出です</p>
    )}
  </section>
);

export const StoreDetailModal = ({
  storeKey,
  storeName,
  dailyKey,
  weeklyKey,
  onClose,
}: Props) => {
  const [daily, setDaily] = useState<Submission | null>(null);
  const [weekly, setWeekly] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      get(ref(db, `submissions/${storeKey}/daily/${dailyKey}`)),
      get(ref(db, `submissions/${storeKey}/weekly/${weeklyKey}`)),
    ]).then(([d, w]) => {
      setDaily((d.val() as Submission | null) ?? null);
      setWeekly((w.val() as Submission | null) ?? null);
      setLoading(false);
    });
  }, [storeKey, dailyKey, weeklyKey]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-bg shadow-2xl animate-slide-up">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-bg/95 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-ink">
              {storeName}
            </h2>
            <p className="truncate text-[11px] text-muted">
              {dailyKey} ／ 週: {weeklyKey.replace(/^W/, "")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-surface2"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">読み込み中…</p>
          ) : (
            <>
              <Grid
                title="デイリー"
                submission={daily}
                onPick={setLightbox}
              />
              <Grid
                title="ウィークリー"
                submission={weekly}
                onPick={setLightbox}
              />
            </>
          )}
        </div>
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
};
