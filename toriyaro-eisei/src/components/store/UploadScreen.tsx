import { useMemo, useState } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot } from '../ui/PhotoSlot';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import { getDateKey, getWeekKey, formatDateJa, weekKeyToMonday, formatWeekRangeJa } from '../../lib/dateUtils';
import { submitReport, type UploadProgress } from '../../hooks/useSubmissions';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  onBack: () => void;
}

const REQUIRED = 7;

const META: Record<ReportType, { title: string; description: string }> = {
  daily: {
    title: 'デイリー衛生チェック',
    description: '所定の7箇所を撮影し、まとめて提出してください。',
  },
  weekly: {
    title: 'ウィークリー衛生チェック',
    description: '週次の7箇所を撮影し、まとめて提出してください。',
  },
};

export const UploadScreen = ({ storeKey, storeName, type, onBack }: Props) => {
  const meta = META[type];
  const [files, setFiles] = useState<Array<File | null>>(() => Array(REQUIRED).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ uploaded: 0, total: 0, retrying: 0 });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const periodKey = useMemo(
    () => (type === 'daily' ? getDateKey() : getWeekKey()),
    [type],
  );
  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => weekKeyToMonday(getWeekKey()), []);

  const filledCount = files.filter(Boolean).length;
  const allFilled = filledCount === REQUIRED;

  const handleCapture = (index: number, file: File) => {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!allFilled || submitting) return;
    setError('');
    setSubmitting(true);
    setProgress({ uploaded: 0, total: REQUIRED, retrying: 0 });
    try {
      await submitReport({
        storeKey,
        storeName,
        type,
        periodKey,
        files: files.filter((f): f is File => !!f),
        onProgress: (p) => setProgress(p),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onBack();
      }, 1400);
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error && /storage\/unauthorized|permission/i.test(e.message)
          ? '権限エラーで提出できません。Firebase Storage のルールを公開設定にしてください。'
          : e instanceof Error && /network|offline|fetch/i.test(e.message)
            ? '通信エラーで提出できませんでした。電波の良い場所で再試行してください。'
            : e instanceof Error
              ? `提出に失敗しました：${e.message}`
              : '提出に失敗しました。再試行してください。';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <AppHeader
        title={meta.title}
        subtitle={
          type === 'daily'
            ? formatDateJa(today)
            : `今週: ${formatWeekRangeJa(monday)}`
        }
        leading={
          <button
            type="button"
            onClick={onBack}
            className="btn-ghost px-3 py-1.5 text-xs"
            aria-label="戻る"
          >
            ← 戻る
          </button>
        }
      />

      <main className="flex-1 px-4 py-5 flex flex-col gap-5">
        <div className="card p-4">
          <h2 className="font-display text-base font-extrabold">{storeName}</h2>
          <p className="text-xs text-text-muted mt-1">{meta.description}</p>
          <div className="flex items-center justify-between mt-4">
            <span className="label !mb-0">選択枚数</span>
            <span className="font-mono text-base font-bold tabular-nums">
              {filledCount}<span className="text-text-muted"> / {REQUIRED}</span>
            </span>
          </div>
          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${type === 'daily' ? 'bg-accent' : 'bg-blue-500'} transition-all`}
              style={{ width: `${(filledCount / REQUIRED) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {files.map((file, idx) => (
            <PhotoSlot
              key={idx}
              index={idx}
              file={file}
              onCapture={(f) => handleCapture(idx, f)}
              disabled={submitting}
            />
          ))}
        </div>

        {error ? (
          <div className="text-sm text-ng bg-ng-bg rounded-xl px-3 py-2 font-medium">{error}</div>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allFilled || submitting}
          className="btn-primary py-4 text-base"
        >
          {submitting
            ? `アップロード中… ${progress.uploaded}/${progress.total}${
                progress.retrying > 0 ? ` (再試行 ${progress.retrying})` : ''
              }`
            : allFilled
              ? '7枚を提出する'
              : `あと ${REQUIRED - filledCount} 枚`}
        </button>
      </main>

      <SuccessOverlay visible={success} subtitle="ご協力ありがとうございました" />
    </div>
  );
};
