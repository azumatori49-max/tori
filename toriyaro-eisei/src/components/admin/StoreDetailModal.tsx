import { useEffect, useState, type FC } from 'react';
import { Lightbox } from '../ui/Lightbox';
import {
  deletePhoto,
  fetchSubmissionsForKey,
  moveSubmission,
} from '../../hooks/useSubmissions';
import {
  dateKeyToDate,
  formatDateTimeJa,
  getMonthKey,
  getWeekKey,
} from '../../lib/dateUtils';
import { itemsForType, targetForType } from '../../data/checkItems';
import type { ReportType, StoreKey, Submission } from '../../types';

interface Props {
  open: boolean;
  storeKey: StoreKey | null;
  storeName: string;
  anchorDateKey: string;
  onClose: () => void;
  readOnly?: boolean;
}

interface LoadedData {
  daily: Submission | null;
  weekly: Submission | null;
  monthly: Submission | null;
}

const normalisePhotos = (raw: unknown): Map<number, string> => {
  const map = new Map<number, string>();
  if (!raw) return map;
  if (Array.isArray(raw)) {
    raw.forEach((v, i) => {
      if (typeof v === 'string' && v.length > 0) map.set(i, v);
    });
    return map;
  }
  if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
      const idx = Number(k);
      if (Number.isInteger(idx) && idx >= 0 && typeof v === 'string' && v.length > 0) {
        map.set(idx, v);
      }
    });
  }
  return map;
};

const formatPhotoTime = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const StoreDetailModal: FC<Props> = ({
  open,
  storeKey,
  storeName,
  anchorDateKey,
  onClose,
  readOnly = false,
}) => {
  const [data, setData] = useState<LoadedData>({ daily: null, weekly: null, monthly: null });
  const [loading, setLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const dailyKey = anchorDateKey;
  const weekKey = getWeekKey(0, dateKeyToDate(anchorDateKey));
  const monthKey = getMonthKey(0, dateKeyToDate(anchorDateKey));

  useEffect(() => {
    if (!open || !storeKey) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchSubmissionsForKey([storeKey], 'daily', dailyKey),
      fetchSubmissionsForKey([storeKey], 'weekly', weekKey),
      fetchSubmissionsForKey([storeKey], 'monthly', monthKey),
    ])
      .then(([d, w, m]) => {
        if (!cancelled) {
          setData({
            daily: d[storeKey] ?? null,
            weekly: w[storeKey] ?? null,
            monthly: m[storeKey] ?? null,
          });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, storeKey, dailyKey, weekKey, monthKey, reloadToken]);

  if (!open) return null;

  const reload = () => setReloadToken((t) => t + 1);

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
                type="daily"
                storeKey={storeKey}
                storeName={storeName}
                currentKey={dailyKey}
                color="text-accent"
                bg="bg-accent/10"
                submission={data.daily}
                onPhotoClick={setLightboxUrl}
                onReload={reload}
                readOnly={readOnly}
              />
              <Section
                label="WEEKLY"
                type="weekly"
                storeKey={storeKey}
                storeName={storeName}
                currentKey={weekKey}
                color="text-blue-600"
                bg="bg-blue-50"
                submission={data.weekly}
                onPhotoClick={setLightboxUrl}
                onReload={reload}
                readOnly={readOnly}
              />
              <Section
                label="MONTHLY"
                type="monthly"
                storeKey={storeKey}
                storeName={storeName}
                currentKey={monthKey}
                color="text-violet-600"
                bg="bg-violet-50"
                submission={data.monthly}
                onPhotoClick={setLightboxUrl}
                onReload={reload}
                readOnly={readOnly}
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
  type: ReportType;
  storeKey: StoreKey | null;
  storeName: string;
  currentKey: string;
  color: string;
  bg: string;
  submission: Submission | null;
  onPhotoClick: (url: string) => void;
  onReload: () => void;
  readOnly: boolean;
}

const Section: FC<SectionProps> = ({
  label,
  type,
  storeKey,
  storeName,
  currentKey,
  color,
  bg,
  submission,
  onPhotoClick,
  onReload,
  readOnly,
}) => {
  const [moving, setMoving] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [busy, setBusy] = useState(false);

  const target = targetForType(type, storeKey, currentKey);
  const items = itemsForType(type, storeKey, currentKey);
  const photos = normalisePhotos(submission?.photos);
  const photoMeta = submission?.photoMeta || {};
  const filledCount = photos.size;

  const lastItem = items[items.length - 1];
  const hasMulti = !!lastItem?.multi;
  const fixedItems = hasMulti ? items.slice(0, -1) : items;
  const fixedCount = fixedItems.length;

  const multiUrls: string[] = [];
  if (hasMulti) {
    let i = fixedCount;
    while (photos.has(i) && i < 20) {
      multiUrls.push(photos.get(i)!);
      i += 1;
    }
  }

  const handleMove = async () => {
    if (!storeKey || !newDate) return;
    const targetKey =
      type === 'daily' ? newDate : getWeekKey(0, new Date(newDate + 'T00:00:00'));
    if (targetKey === currentKey) {
      alert('同じ' + (type === 'daily' ? '日付' : '週') + 'です');
      return;
    }
    const lbl =
      type === 'daily' ? targetKey : `週 ${targetKey.slice(1)} 起算`;
    if (
      !confirm(
        `${storeName} の${type === 'daily' ? 'デイリー' : 'ウィークリー'}を ${lbl} に移動しますか？\n（同じスロット番号は既存データを優先してマージされます）`,
      )
    )
      return;
    setBusy(true);
    try {
      await moveSubmission(storeKey, type, currentKey, targetKey);
      setMoving(false);
      setNewDate('');
      onReload();
    } catch (err) {
      alert('移動失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePhoto = async (idx: number) => {
    if (!storeKey) return;
    if (!confirm(`#${idx + 1} の写真を削除しますか？`)) return;
    setBusy(true);
    try {
      await deletePhoto(storeKey, type, currentKey, idx);
      onReload();
    } catch (err) {
      alert('削除失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest font-display ${bg} ${color}`}
        >
          {label}
        </span>
        <span className="text-xs font-bold">
          {filledCount} 枚 / 目標 {target}
        </span>
      </div>
      {submission ? (
        <p className="mb-2 text-[11px] text-text-muted">
          提出: {formatDateTimeJa(submission.submittedAt)}
        </p>
      ) : (
        <p className="mb-2 text-[11px] text-ng">未提出</p>
      )}

      {!readOnly && submission && type !== 'monthly' && (
        <div className="mb-3">
          {!moving ? (
            <button
              type="button"
              onClick={() => setMoving(true)}
              className="text-[11px] font-bold text-accent hover:underline"
            >
              別の{type === 'daily' ? '日' : '週'}に移動
            </button>
          ) : (
            <div className="rounded-lg border border-border bg-bg p-2.5 space-y-2">
              <p className="text-[10px] font-bold text-text-muted">
                移動先の{type === 'daily' ? '日付' : '週（その週内の任意の日付）'}
              </p>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded border border-border bg-surface px-2 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleMove}
                  disabled={!newDate || busy}
                  className="flex-1 rounded bg-accent py-1.5 text-[11px] font-bold text-white disabled:bg-text-muted/40"
                >
                  {busy ? '移動中…' : '移動'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoving(false);
                    setNewDate('');
                  }}
                  disabled={busy}
                  className="flex-1 rounded border border-border bg-white py-1.5 text-[11px] font-bold text-text-muted"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {fixedItems.map((item, i) => {
          const url = photos.get(i);
          const t = photoMeta[String(i)]?.uploadedAt;
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="relative">
                <button
                  type="button"
                  disabled={!url}
                  onClick={() => url && onPhotoClick(url)}
                  className={`relative aspect-square w-full overflow-hidden rounded-lg border ${
                    url ? 'border-border bg-surface' : 'border-dashed border-border bg-surface2'
                  }`}
                >
                  {url ? (
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                      #{i + 1}
                    </span>
                  )}
                </button>
                {!readOnly && url && (
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(i)}
                    disabled={busy}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ng text-xs text-white shadow disabled:opacity-50"
                    aria-label="削除"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="px-1 text-center text-[10px] font-bold leading-tight text-text">
                {i + 1}. {item.label}
              </div>
              {t && (
                <div className="text-center text-[9px] text-text-muted">
                  {formatPhotoTime(t)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMulti && lastItem && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-bold">
            {fixedCount + 1}. {lastItem.label}
            <span className="ml-2 text-[10px] font-normal text-text-muted">
              {multiUrls.length} 枚
            </span>
          </h4>
          {multiUrls.length === 0 ? (
            <p className="rounded-lg bg-surface2 px-3 py-2 text-[11px] text-text-muted">
              未提出
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {multiUrls.map((url, i) => {
                const slotIdx = fixedCount + i;
                const t = photoMeta[String(slotIdx)]?.uploadedAt;
                return (
                  <div key={i} className="flex flex-col gap-0.5">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => onPhotoClick(url)}
                        className="aspect-square w-full overflow-hidden rounded-md border border-border bg-surface"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(slotIdx)}
                          disabled={busy}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ng text-xs text-white shadow disabled:opacity-50"
                          aria-label="削除"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {t && (
                      <div className="text-center text-[9px] text-text-muted">
                        {formatPhotoTime(t)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};