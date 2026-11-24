import type { FC } from 'react';
import { StatusChip, statusFromCount, statusLabel } from '../ui/StatusChip';
import { formatDateTimeJa } from '../../lib/dateUtils';
import { targetForType } from '../../data/checkItems';
import type { ReportType, StoreKey, Submission } from '../../types';

interface Props {
  variant: ReportType;
  storeKey: StoreKey;
  title: string;
  description: string;
  submission: Submission | null;
  /** true のとき「確認のみ」（朝の締め切り時間帯など）。ボタンの文言だけが変わる */
  viewOnly?: boolean;
  onOpen: () => void;
}

const VARIANT: Record<ReportType, { label: string; border: string; chip: string }> = {
  daily: {
    label: 'デイリー',
    border: 'border-l-accent',
    chip: 'bg-accent/10 text-accent',
  },
  weekly: {
    label: 'ウィークリー',
    border: 'border-l-blue-500',
    chip: 'bg-blue-50 text-blue-600',
  },
  monthly: {
    label: 'マンスリー',
    border: 'border-l-violet-500',
    chip: 'bg-violet-50 text-violet-600',
  },
};

export const ReportCard: FC<Props> = ({
  variant,
  storeKey,
  title,
  description,
  submission,
  viewOnly = false,
  onOpen,
}) => {
  const v = VARIANT[variant];
  const target = targetForType(variant, storeKey);
  const count = submission?.count ?? 0;
  // LINE報告で提出済みにしてもらった分は、枚数に関係なく提出済みとして見せる
  const isLine = !!submission?.viaLine;
  const status = isLine ? 'ok' : statusFromCount(count, target);
  const pct = isLine ? 100 : Math.min(100, (count / target) * 100);
  const remaining = Math.max(0, target - count);

  // カード下部のボタン（カード全体が押せるので、見た目だけのボタン）
  const action = viewOnly
    ? { label: '写真を確認する', primary: false }
    : status === 'ok'
      ? { label: '写真を確認・撮り直す', primary: false }
      : status === 'warn'
        ? { label: `続きを撮る（あと${remaining}枚）`, primary: true }
        : { label: '撮影する', primary: true };

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition active:scale-[0.99] border-l-4 ${v.border}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${v.chip}`}
        >
          {v.label}
        </span>
        <StatusChip kind={status}>{isLine ? '提出済み（LINE）' : statusLabel(status)}</StatusChip>
      </div>
      <h3 className="mt-3 text-base font-bold">{title}</h3>
      <p className="mt-1 text-sm text-text-muted">{description}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-text-muted">提出枚数</span>
          <span>
            <span className="text-base">{count}</span> / {target} 枚
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface2">
          <div
            className={`h-full rounded-full transition-all ${
              status === 'ok' ? 'bg-ok' : status === 'warn' ? 'bg-warn' : 'bg-border'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {submission && (
          <p className="mt-2 text-xs text-text-muted">
            最終提出: {formatDateTimeJa(submission.submittedAt)}
          </p>
        )}
      </div>

      <span
        className={`mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl px-3 text-sm font-bold ${
          action.primary
            ? 'bg-accent text-white shadow-sm'
            : 'border border-border bg-surface text-text'
        }`}
      >
        {action.label}
      </span>
    </button>
  );
};