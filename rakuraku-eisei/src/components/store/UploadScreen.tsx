import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot } from '../ui/PhotoSlot';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import { submitReport, useSubmission, type SubmitSlot } from '../../hooks/useSubmissions';
import { resolveLabels, useReportItems } from '../../hooks/useReportItems';
import { useStores } from '../../hooks/useStores';
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

type SlotState =
  | { kind: 'empty' }
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File; preview: string };

const emptySlots = (): SlotState[] => Array.from({ length: 7 }, () => ({ kind: 'empty' }));

export const UploadScreen = ({ storeKey, storeName, type, onBack, onDone }: Props) => {
  const key = useMemo(
    () => (type === 'daily' ? getDateKey() : getWeekKey()),
    [type]
  );
  const { submission, loading } = useSubmission(storeKey, type, key);
  const { items } = useReportItems();
  const { stores } = useStores();
  const labels = resolveLabels(items, stores[storeKey], type);

  const [slots, setSlots] = useState<SlotState[]>(emptySlots);
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || hydrated) return;
    if (submission?.photos?.length) {
      const next = emptySlots();
      submission.photos.slice(0, 7).forEach((url, i) => {
        next[i] = { kind: 'existing', url };
      });
      setSlots(next);
    }
    setHydrated(true);
  }, [loading, hydrated, submission]);

  useEffect(() => {
    return () => {
      slots.forEach((s) => {
        if (s.kind === 'new') URL.revokeObjectURL(s.preview);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filledCount = slots.filter((s) => s.kind !== 'empty').length;
  const newCount = slots.filter((s) => s.kind === 'new').length;
  const isEditing = !!submission;
  const meta = TITLES[type];

  const pick = (i: number, file: File) => {
    setError('');
    setSlots((prev) => {
      const next = [...prev];
      const current = next[i];
      if (current.kind === 'new') URL.revokeObjectURL(current.preview);
      next[i] = { kind: 'new', file, preview: URL.createObjectURL(file) };
      return next;
    });
  };

  const handleSubmit = async () => {
    if (filledCount < 7) return;
    if (isEditing && newCount === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const payload: SubmitSlot[] = slots.map((s) => {
        if (s.kind === 'existing') return { kind: 'existing', url: s.url };
        if (s.kind === 'new') return { kind: 'new', file: s.file };
        throw new Error('未撮影のスロットがあります');
      });
      await submitReport(storeKey, storeName, type, key, payload);
      setSuccess(true);
      setTimeout(() => {
        slots.forEach((s) => {
          if (s.kind === 'new') URL.revokeObjectURL(s.preview);
        });
        onDone();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : '提出に失敗しました');
      setSubmitting(false);
    }
  };

  const previewUrl = (s: SlotState): string | undefined => {
    if (s.kind === 'existing') return s.url;
    if (s.kind === 'new') return s.preview;
    return undefined;
  };

  const submitLabel = submitting
    ? '提出中…'
    : filledCount < 7
      ? `あと${7 - filledCount}枚`
      : isEditing
        ? newCount === 0
          ? '変更なし'
          : `更新する（${newCount}枚を差替）`
        : '提出する';

  const submitDisabled =
    filledCount < 7 || submitting || (isEditing && newCount === 0);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader title={meta.title} subtitle={storeName} onBack={submitting ? undefined : onBack} />
      <div className="mx-auto w-full max-w-app flex-1 px-4 py-4">
        <p className="text-sm text-text-muted">{meta.desc}</p>
        {isEditing && (
          <div className="mt-3 rounded-lg bg-ok-bg px-3 py-2 text-xs font-bold text-ok">
            提出済み — 撮り直したい枠をタップしてください
          </div>
        )}
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
          {slots.map((s, i) => (
            <div key={i}>
              <PhotoSlot
                index={i}
                url={previewUrl(s)}
                onPick={(f) => pick(i, f)}
              />
              <p className="mt-1 truncate text-center text-[10px] font-bold text-text-muted">
                {i + 1}. {labels[i] || `項目${i + 1}`}
              </p>
            </div>
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
          disabled={submitDisabled}
          className="mt-6 w-full rounded-lg bg-accent py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-text-muted/40 disabled:text-white"
        >
          {submitLabel}
        </button>
        <p className="mt-3 text-center text-[11px] text-text-muted">
          ※ 撮影済みの枠をタップすると再撮影できます
        </p>
      </div>
      <SuccessOverlay visible={success} message={isEditing ? '更新完了' : '提出完了'} />
    </div>
  );
};
