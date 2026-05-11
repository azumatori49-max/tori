import { useMemo, useState } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot } from '../ui/PhotoSlot';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import { submitReport } from '../../hooks/useSubmissions';
import { getDateKey, getWeekKey } from '../../lib/dateUtils';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  onBack: () => void;
  onDone: () => void;
}

const TITLES: Record<ReportType, { title: string; desc: string }> = {
  daily: {
    title: 'デイリー衛生チェック',
    desc: '指定の7箇所を順番に撮影してください',
  },
  weekly: {
    title: 'ウィークリー衛生チェック',
    desc: '今週の7箇所を撮影してください',
  },
};

export const UploadScreen = ({ storeKey, storeName, type, onBack, onDone }: Props) => {
  const [files, setFiles] = useState<(File | null)[]>(Array(7).fill(null));
  const [previews, setPreviews] = useState<(string | null)[]>(Array(7).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const key = useMemo(
    () => (type === 'daily' ? getDateKey() : getWeekKey()),
    [type]
  );

  const filledCount = files.filter(Boolean).length;
  const meta = TITLES[type];

  const pick = (i: number, file: File) => {
    setError('');
    setFiles((prev) => {
      const next = [...prev];
      next[i] = file;
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      if (next[i]) URL.revokeObjectURL(next[i]!);
      next[i] = URL.createObjectURL(file);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (filledCount < 7) return;
    setSubmitting(true);
    setError('');
    try {
      const valid = files.filter((f): f is File => !!f);
      await submitReport(storeKey, storeName, type, key, valid);
      setSuccess(true);
      setTimeout(() => {
        previews.forEach((p) => p && URL.revokeObjectURL(p));
        onDone();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : '提出に失敗しました');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title={meta.title} subtitle={storeName} onBack={submitting ? undefined : onBack} />
      <div className="mx-auto w-full max-w-app flex-1 px-4 py-4">
        <p className="text-sm text-text-muted">{meta.desc}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-bold text-text-muted">選択枚数</span>
          <span className="text-sm font-bold text-text">
            <span className={filledCount === 7 ? 'text-ok' : 'text-accent'}>{filledCount}</span>
            <span className="text-text-muted"> / 7枚</span>
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
          <div
            className={`h-full transition-all ${filledCount === 7 ? 'bg-ok' : 'bg-accent'}`}
            style={{ width: `${(filledCount / 7) * 100}%` }}
          />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <PhotoSlot
              key={i}
              index={i}
              url={previews[i] ?? undefined}
              onPick={(f) => pick(i, f)}
            />
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-ng-bg px-3 py-2 text-xs font-bold text-ng">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={filledCount < 7 || submitting}
          className="mt-6 w-full rounded-lg bg-accent py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-text-muted/40 disabled:text-white"
        >
          {submitting ? '提出中…' : filledCount < 7 ? `あと${7 - filledCount}枚` : '提出する'}
        </button>
        <p className="mt-3 text-center text-[11px] text-text-muted">
          ※ 撮影済みの枠をタップすると再撮影できます
        </p>
      </div>
      <SuccessOverlay visible={success} message="提出完了" />
    </div>
  );
};
