import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot } from '../ui/PhotoSlot';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import { fileToPreviewUrl } from '../../lib/imageUtils';
import { getDateKey, getWeekKey } from '../../lib/dateUtils';
import { submitReport } from '../../hooks/useSubmissions';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  reportType: ReportType;
  onBack: () => void;
}

const TOTAL_SLOTS = 7;

const TITLES: Record<ReportType, string> = {
  daily: 'デイリー衛生チェック',
  weekly: 'ウィークリー衛生チェック',
};

export const UploadScreen = ({ storeKey, storeName, reportType, onBack }: Props) => {
  const periodKey = useMemo(
    () => (reportType === 'daily' ? getDateKey() : getWeekKey()),
    [reportType],
  );

  const [files, setFiles] = useState<(File | null)[]>(() => Array(TOTAL_SLOTS).fill(null));
  const [previews, setPreviews] = useState<(string | null)[]>(() => Array(TOTAL_SLOTS).fill(null));
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

  const selectedCount = files.filter(Boolean).length;
  const allReady = selectedCount === TOTAL_SLOTS;

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
    if (!allReady || submitting) return;
    setError(null);
    setSubmitting(true);
    setProgress({ done: 0, total: TOTAL_SLOTS });
    try {
      await submitReport({
        storeKey,
        storeName,
        reportType,
        periodKey,
        files: files.filter((f): f is File => f != null),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onBack();
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提出に失敗しました');
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col pb-32">
      <AppHeader title={TITLES[reportType]} subtitle={storeName} onBack={onBack} />
      <main className="flex-1 max-w-screen-sm w-full mx-auto px-4 py-5 space-y-4">
        <div className="bg-surface2 rounded-xl p-3 text-xs text-text-muted leading-relaxed">
          指定の7か所を順に撮影してください。スロットをタップするとカメラが起動します。
          再撮影もスロットをタップしてください。
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">撮影枚数</span>
          <span className="text-sm font-bold tabular-nums">
            <span className={allReady ? 'text-ok' : 'text-accent'}>{selectedCount}</span>
            <span className="text-text-muted"> / {TOTAL_SLOTS}枚</span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
            <PhotoSlot
              key={i}
              index={i}
              previewUrl={previews[i]}
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
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
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
            disabled={!allReady || submitting}
            className="w-full bg-accent text-white font-bold rounded-xl py-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition"
          >
            {submitting ? '提出中...' : allReady ? '提出する' : `あと ${TOTAL_SLOTS - selectedCount} 枚`}
          </button>
        </div>
      </div>

      <SuccessOverlay visible={success} />
    </div>
  );
};
