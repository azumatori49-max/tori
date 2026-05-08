import { useEffect, useMemo, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot } from '../ui/PhotoSlot';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import { submitPhotos, useStoreSubmissionStatus } from '../../hooks/useSubmissions';
import { itemsForType, targetForType } from '../../data/checkItems';
import { getDateKey, getWeekKey } from '../../lib/dateUtils';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  onBack: () => void;
}

export const UploadScreen: FC<Props> = ({ storeKey, storeName, type, onBack }) => {
  const dateOrWeekKey = type === 'daily' ? getDateKey() : getWeekKey();
  const { submission: existing } = useStoreSubmissionStatus(storeKey, type, dateOrWeekKey);

  const TARGET = targetForType(type);
  const ITEMS = itemsForType(type);

  const existingCount = useMemo(() => {
    const p = existing?.photos as unknown;
    if (!p) return 0;
    if (Array.isArray(p)) return p.filter((x) => typeof x === 'string' && x).length;
    if (typeof p === 'object')
      return Object.values(p as Record<string, unknown>).filter(
        (x) => typeof x === 'string' && x,
      ).length;
    return 0;
  }, [existing]);

  const remaining = Math.max(0, TARGET - existingCount);

  const [files, setFiles] = useState<Array<File | null>>(() => Array(TARGET).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ uploaded: number; total: number } | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // type 切替時に枚数が変わるのでスロットを揃える
  useEffect(() => {
    setFiles(Array(TARGET).fill(null));
  }, [TARGET]);

  useEffect(() => {
    if (success) {
      const t = window.setTimeout(() => {
        setSuccess(false);
        onBack();
      }, 1400);
      return () => window.clearTimeout(t);
    }
  }, [success, onBack]);

  const filledCount = files.filter(Boolean).length;
  const canSubmit = filledCount > 0 && filledCount <= remaining && !submitting;

  const setFileAt = (idx: number, file: File) => {
    setFiles((prev) => {
      const next = [...prev];
      next[idx] = file;
      return next;
    });
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    const filesToSend = files.filter((f): f is File => !!f);
    setError(null);
    setSubmitting(true);
    setProgress({ uploaded: 0, total: filesToSend.length });
    try {
      await submitPhotos({
        storeKey,
        storeName,
        type,
        dateOrWeekKey,
        files: filesToSend,
        onProgress: (uploaded, total) => setProgress({ uploaded, total }),
      });
      setFiles(Array(TARGET).fill(null));
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('アップロードに失敗しました。電波状況を確認して再試行してください');
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  // 残り枚数分のスロットを表示。ラベルは既存枚数の次から割り当て。
  const visibleSlots = files.slice(0, Math.max(remaining, 1));

  return (
    <div className="min-h-screen bg-bg pb-32">
      <AppHeader
        title={type === 'daily' ? '毎日の衛生チェック' : '週次の衛生チェック'}
        subtitle={storeName}
        left={
          <button
            type="button"
            onClick={onBack}
            className="text-lg text-text-muted hover:text-accent"
            aria-label="戻る"
          >
            ←
          </button>
        }
      />

      <main className="mx-auto w-full max-w-app px-4 py-5">
        <p className="text-sm text-text-muted">
          {type === 'daily'
            ? `本日分の衛生チェック写真を ${TARGET}枚撮影してください。`
            : `今週分の衛生チェック写真を ${TARGET}枚撮影してください。`}
          <br />
          まとめても、何回かに分けて送信してもOKです。
        </p>

        {existingCount > 0 && existingCount < TARGET && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent">
            すでに {existingCount} 枚 提出済み。あと {remaining} 枚で完了します。
          </div>
        )}
        {existingCount >= TARGET && (
          <div className="mt-3 rounded-xl border border-warn-bg bg-warn-bg/60 px-3 py-2 text-xs font-bold text-warn">
            この期間はすでに {TARGET} 枚提出済みです。これ以上は送信できません。
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-bold text-text-muted">今回の追加分</span>
          <span className="text-sm font-bold">
            <span className="text-lg text-accent">{filledCount}</span> /{' '}
            {remaining > 0 ? remaining : 0}枚
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleSlots.map((file, i) => {
            const slotIndex = existingCount + i;
            const item = ITEMS[slotIndex];
            return (
              <PhotoSlot
                key={i}
                index={slotIndex}
                file={file}
                onPick={(f) => setFileAt(i, f)}
                disabled={submitting || remaining === 0}
                label={item?.label}
                source={item?.source ?? 'camera'}
              />
            );
          })}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-ng-bg px-3 py-2 text-xs font-bold text-ng">{error}</p>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto w-full max-w-app px-4 py-3">
          {progress && (
            <div className="mb-2">
              <div className="flex justify-between text-[11px] font-bold text-text-muted">
                <span>アップロード中…</span>
                <span>
                  {progress.uploaded} / {progress.total}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${(progress.uploaded / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
          >
            {submitting
              ? '送信中…'
              : remaining === 0
                ? '提出済み'
                : filledCount === 0
                  ? '写真を選択してください'
                  : `${filledCount}枚を提出する`}
          </button>
        </div>
      </div>

      <SuccessOverlay open={success} message="提出完了！" />
    </div>
  );
};
