import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot } from '../ui/PhotoSlot';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import { fileToPreviewUrl } from '../../lib/imageUtils';
import { getDateKey, getWeekKey } from '../../lib/dateUtils';
import { getSlots } from '../../data/reportItems';
import {
  normalizePhotos,
  submitReport,
  useStoreSubmission,
} from '../../hooks/useSubmissions';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  reportType: ReportType;
  onBack: () => void;
}

const TITLES: Record<ReportType, string> = {
  daily: 'デイリー衛生チェック',
  weekly: 'ウィークリー衛生チェック',
};

export const UploadScreen = ({ storeKey, storeName, reportType, onBack }: Props) => {
  const slots = useMemo(() => getSlots(reportType), [reportType]);
  const totalSlots = slots.length;

  const periodKey = useMemo(
    () => (reportType === 'daily' ? getDateKey() : getWeekKey()),
    [reportType],
  );

  const { submission, loading: subLoading, reload } = useStoreSubmission(
    storeKey,
    reportType,
    periodKey,
  );

  const existingPhotos = useMemo(
    () => normalizePhotos(submission?.photos, totalSlots),
    [submission, totalSlots],
  );

  const [files, setFiles] = useState<(File | null)[]>(() =>
    Array(totalSlots).fill(null),
  );
  const [previews, setPreviews] = useState<(string | null)[]>(() =>
    Array(totalSlots).fill(null),
  );
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const previewsRef = useRef(previews);
  previewsRef.current = previews;

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((p) => p && URL.revokeObjectURL(p));
    };
  }, []);

  useEffect(() => {
    setFiles(Array(totalSlots).fill(null));
    setPreviews((prev) => {
      prev.forEach((p) => p && URL.revokeObjectURL(p));
      return Array(totalSlots).fill(null);
    });
  }, [totalSlots, periodKey]);

  const newCount = files.filter(Boolean).length;
  const existingCount = existingPhotos.filter(Boolean).length;
  const stagedCount = files.reduce((acc, f, i) => {
    if (f) return acc + 1;
    if (existingPhotos[i]) return acc + 1;
    return acc;
  }, 0);

  const handleSelect = (idx: number, file: File) => {
    setFiles((prev) => {
      const next = [...prev];
      next[idx] = file;
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      if (next[idx]) URL.revokeObjectURL(next[idx]!);
      next[idx] = fileToPreviewUrl(file);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (newCount === 0 || submitting) return;
    setError(null);
    setSubmitting(true);
    setProgress({ done: 0, total: newCount });
    try {
      await submitReport({
        storeKey,
        storeName,
        reportType,
        periodKey,
        total: totalSlots,
        files,
        existingPhotos,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        void reload();
        onBack();
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提出に失敗しました');
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  const slotPreview = (i: number): string | null =>
    previews[i] ?? (existingPhotos[i] ? existingPhotos[i] : null);

  return (
    <div className="min-h-full flex flex-col pb-32">
      <AppHeader title={TITLES[reportType]} subtitle={storeName} onBack={onBack} />
      <main className="flex-1 max-w-screen-sm w-full mx-auto px-4 py-5 space-y-4">
        <div className="bg-surface2 rounded-xl p-3 text-xs text-text-muted leading-relaxed">
          {reportType === 'daily'
            ? '指定の7か所を撮影してください。'
            : '指定の8項目を撮影/選択してください。「防犯カメラ」のみ写真フォルダから選べます。'}
          <br />
          7枚（または8枚）揃わなくても、撮影した分だけアップロードできます。
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">提出予定枚数</span>
          <span className="text-sm font-bold tabular-nums">
            <span className={stagedCount >= totalSlots ? 'text-ok' : 'text-accent'}>
              {stagedCount}
            </span>
            <span className="text-text-muted"> / {totalSlots}枚</span>
          </span>
        </div>

        {existingCount > 0 && !subLoading && (
          <div className="bg-ok-bg text-ok text-xs font-bold rounded-lg px-3 py-2">
            既に {existingCount} 枚アップロード済みです。撮り直したいスロットを上書きできます。
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {slots.map((s, i) => (
            <PhotoSlot
              key={i}
              index={i}
              label={s.label}
              galleryAllowed={s.galleryAllowed}
              previewUrl={slotPreview(i)}
              onSelect={(f) => handleSelect(i, f)}
              disabled={submitting}
            />
          ))}
        </div>

        {error && (
          <div className="bg-ng-bg text-ng text-xs font-bold rounded-lg px-3 py-2">{error}</div>
        )}

        {progress && (
          <div className="bg-surface border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold">アップロード中...</span>
              <span className="text-xs tabular-nums">
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="h-2 bg-surface2 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-surface border-t border-border">
        <div className="max-w-screen-sm mx-auto px-4 py-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={newCount === 0 || submitting}
            className="w-full bg-accent text-white font-bold rounded-xl py-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition"
          >
            {submitting
              ? 'アップロード中...'
              : newCount === 0
                ? '撮影してください'
                : `${newCount}枚をアップロード`}
          </button>
          {newCount > 0 && newCount < totalSlots && !submitting && (
            <p className="text-[11px] text-text-muted text-center mt-1.5">
              残り {totalSlots - stagedCount} 枚は後からでも追加できます
            </p>
          )}
        </div>
      </div>

      <SuccessOverlay visible={success} />
    </div>
  );
};
