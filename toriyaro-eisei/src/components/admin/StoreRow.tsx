import type { FC } from 'react';
import { StatusChip, statusFromCount, statusLabel } from '../ui/StatusChip';
import { formatDateTimeJa } from '../../lib/dateUtils';
import { itemsForType, targetForType } from '../../data/checkItems';
import type { ReportType, StoreKey, Submission } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  dateOrWeekKey: string;
  submission: Submission | null;
  onClick: () => void;
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

/**
 * 提出確認の一覧の1店舗ぶん。行全体を押すと店舗の詳細が開く。
 * - 未提出: 1行だけ（店舗名とチップ）
 * - 一部提出: 提出済みの写真と、足りない項目名
 * - 提出済み: 写真と提出日時
 * LINE報告の操作は一覧には置かず、詳細画面の中で行う（誤操作を防ぎ、一覧を短くするため）。
 */
export const StoreRow: FC<Props> = ({ storeKey, storeName, type, dateOrWeekKey, submission, onClick }) => {
  const target = targetForType(type, storeKey, dateOrWeekKey);
  const photos = normalisePhotos(submission?.photos);
  const photoCount = photos.size;
  const isLine = !!submission?.viaLine;
  const status = isLine ? 'ok' : statusFromCount(photoCount, target);

  // 足りない項目（複数枚OKの最後の項目は、1枚も無いときだけ挙げる）
  const items = itemsForType(type, storeKey, dateOrWeekKey);
  const lastItem = items[items.length - 1];
  const fixedCount = lastItem?.multi ? items.length - 1 : items.length;
  const missing: string[] = [];
  if (status === 'warn') {
    items.forEach((it, i) => {
      const has = i < fixedCount ? photos.has(i) : Array.from(photos.keys()).some((n) => n >= fixedCount);
      if (!has) missing.push(`${i + 1}. ${it.label}`);
    });
  }
  const urls = Array.from(photos.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, url]) => url);

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-2xl border border-border bg-surface px-4 py-3 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex min-h-[28px] items-center justify-between gap-2">
        <h3 className="truncate text-sm font-bold">{storeName}</h3>
        <StatusChip kind={status} className="shrink-0">
          {isLine ? '提出済み（LINE）' : status === 'warn' ? `一部提出 ${photoCount}/${target}枚` : statusLabel(status)}
        </StatusChip>
      </div>

      {urls.length > 0 && (
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
          {urls.map((url, i) => (
            <div key={i} className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border">
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <p className="mt-2 text-xs font-bold text-ng">抜け：{missing.join('、')}</p>
      )}

      {isLine && (
        <p className="mt-2 text-xs font-bold text-ok">
          {photoCount > 0 ? `写真 ${photoCount} 枚 + LINE報告で完了` : 'LINE報告として記録済み（写真なし）'}
        </p>
      )}

      {submission && (
        <p className="mt-1.5 text-xs text-text-muted">提出: {formatDateTimeJa(submission.submittedAt)}</p>
      )}
    </button>
  );
};
