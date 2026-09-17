import { useState, type FC, type MouseEvent } from 'react';
import { StatusChip, statusFromCount, statusLabel } from '../ui/StatusChip';
import { formatDateTimeJa } from '../../lib/dateUtils';
import { targetForType } from '../../data/checkItems';
import { markAsLineReport, unmarkSubmission } from '../../hooks/useSubmissions';
import type { ReportType, StoreKey, Submission } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  dateOrWeekKey: string;
  submission: Submission | null;
  onClick: () => void;
  onReload: () => void;
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

export const StoreRow: FC<Props> = ({
  storeKey,
  storeName,
  type,
  dateOrWeekKey,
  submission,
  onClick,
  onReload,
}) => {
  const [busy, setBusy] = useState(false);
  const target = targetForType(type, storeKey);
  const photos = normalisePhotos(submission?.photos);
  const photoCount = photos.size;
  const isLine = !!submission?.viaLine;
  const status = isLine ? 'ok' : statusFromCount(photoCount, target);
  const canMarkLine = !isLine && photoCount < target;

  let maxKey = -1;
  photos.forEach((_, k) => {
    if (k > maxKey) maxKey = k;
  });
  const slotCount = Math.max(target, maxKey + 1);

  const handleMarkLine = async (e: MouseEvent) => {
    e.stopPropagation();
    const msg = photoCount > 0
      ? `${storeName} に LINE報告を加えて提出済みにしますか？（既存の写真 ${photoCount} 枚は保持されます）`
      : `${storeName} を LINE報告として提出済みにしますか？`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await markAsLineReport(storeKey, storeName, type, dateOrWeekKey);
      onReload();
    } catch (err) {
      alert('失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleUnmark = async (e: MouseEvent) => {
    e.stopPropagation();
    const msg = photoCount > 0
      ? `${storeName} の LINE報告マークを取消しますか？（写真 ${photoCount} 枚は残ります）`
      : `${storeName} の LINE報告を取消（未提出に戻す）しますか？`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await unmarkSubmission(storeKey, type, dateOrWeekKey);
      onReload();
    } catch (err) {
      alert('失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left transition active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-bold">{storeName}</h3>
          <StatusChip kind={status}>
            {isLine ? '提出済み（LINE）' : statusLabel(status)}
          </StatusChip>
        </div>

        {(photoCount > 0 || !isLine) && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
            {Array.from({ length: slotCount }).map((_, i) => {
              const url = photos.get(i);
              return (
                <div
                  key={i}
                  className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border ${
                    url ? 'border-border' : 'border-dashed border-border bg-surface2'
                  }`}
                >
                  {url ? (
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-text-muted">
                      —
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isLine && (
          <div className="mt-2 rounded-lg bg-ok-bg px-3 py-2 text-xs font-bold text-ok">
            {photoCount > 0
              ? `写真 ${photoCount} 枚 + LINE報告で完了`
              : 'LINE報告として記録済み（写真なし）'}
          </div>
        )}

        {submission ? (
          <p className="mt-2 text-[11px] text-text-muted">
            提出: {formatDateTimeJa(submission.submittedAt)}
            {!isLine && ` ・ ${photoCount}枚`}
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-ng">未提出</p>
        )}
      </button>

      {canMarkLine && (
        <button
          type="button"
          onClick={handleMarkLine}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-accent bg-white px-3 py-2 text-xs font-bold text-accent transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? '処理中…' : photoCount > 0 ? '残りをLINE報告として完了にする' : 'LINE報告として提出済みにする'}
        </button>
      )}
      {isLine && (
        <button
          type="button"
          onClick={handleUnmark}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-text-muted transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? '処理中…' : 'LINE報告マークを取消'}
        </button>
      )}
    </div>
  );
};