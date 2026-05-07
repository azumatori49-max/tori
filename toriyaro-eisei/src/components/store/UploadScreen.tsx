import { get, ref } from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';
import { authReady, db } from '../../lib/firebase';
import {
  formatDateJa,
  formatWeekRangeJa,
  getDateKey,
  getWeekKey,
  weekKeyToMonday,
} from '../../lib/dateUtils';
import { uploadSinglePhoto } from '../../hooks/useSubmissions';
import { slotCountFor, slotInputMode, slotLabelFor } from '../../data/slotLabels';
import type { ReportType, StoreKey, Submission } from '../../types';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot, type SlotStatus } from '../ui/PhotoSlot';
import { SuccessOverlay } from '../ui/SuccessOverlay';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  onBack: () => void;
}

const META: Record<ReportType, { title: string; description: string }> = {
  daily: {
    title: 'デイリー衛生チェック',
    description:
      '所定の項目を撮影し、最後に「アップロード」ボタンを押して送信してください。',
  },
  weekly: {
    title: 'ウィークリー衛生チェック',
    description:
      '7項目をカメラで撮影、防犯カメラのみ写真フォルダから選択。最後に「アップロード」ボタンを押して送信してください。',
  },
};

interface SlotState {
  url: string | null;
  status: SlotStatus;
  pendingFile: File | null;
  errorMessage?: string;
}

const explainError = (e: unknown): string => {
  const raw = e instanceof Error ? e.message : String(e);
  if (/admin-restricted-operation|operation-not-allowed/i.test(raw)) {
    return '匿名認証が有効化されていません。Firebase Console → Authentication → ログイン方法 で「匿名」を有効化してください。';
  }
  if (/storage\/unauthorized|permission|denied/i.test(raw)) {
    return 'Storage ルールで拒否されました。Firebase Console → Storage → ルール で auth != null 設定を公開してください。';
  }
  if (/network|offline|fetch|timeout/i.test(raw)) {
    return '通信エラーで送信できませんでした。電波の良い場所で再試行してください。';
  }
  if (/quota|limit/i.test(raw)) {
    return '容量上限に達しました。管理者に連絡してください。';
  }
  return raw || '原因不明のエラーで送信できませんでした。';
};

const buildEmpty = (type: ReportType): SlotState[] =>
  Array.from({ length: slotCountFor(type) }, () => ({
    url: null,
    status: 'empty',
    pendingFile: null,
  }));

const hydrate = (type: ReportType, existing: Submission | null): SlotState[] => {
  const total = slotCountFor(type);
  const photos = existing?.photos ?? [];
  return Array.from({ length: total }, (_, i) => ({
    url: photos[i] ?? null,
    status: photos[i] ? ('uploaded' as SlotStatus) : ('empty' as SlotStatus),
    pendingFile: null,
  }));
};

export const UploadScreen = ({ storeKey, storeName, type, onBack }: Props) => {
  const meta = META[type];
  const total = slotCountFor(type);
  const [slots, setSlots] = useState<SlotState[]>(() => buildEmpty(type));
  const [hydrating, setHydrating] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [completedShown, setCompletedShown] = useState(false);

  const periodKey = useMemo(
    () => (type === 'daily' ? getDateKey() : getWeekKey()),
    [type],
  );
  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => weekKeyToMonday(getWeekKey()), []);

  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    setSlots(buildEmpty(type));
    authReady
      .then(() => get(ref(db, `submissions/${storeKey}/${type}/${periodKey}`)))
      .then((snap) => {
        if (cancelled) return;
        setSlots(hydrate(type, snap.val() as Submission | null));
      })
      .catch((err) => console.error('hydrate failed:', err))
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeKey, type, periodKey]);

  const handleCapture = (idx: number) => (file: File) => {
    setBannerError(null);
    setSlots((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              url: null,
              status: 'captured' as SlotStatus,
              pendingFile: file,
              errorMessage: undefined,
            }
          : s,
      ),
    );
  };

  const pendingIndices = slots
    .map((s, i) => (s.status === 'captured' || s.status === 'failed' ? i : -1))
    .filter((i) => i >= 0);

  const handleUpload = async () => {
    if (uploading || pendingIndices.length === 0) return;
    setUploading(true);
    setBannerError(null);
    setProgress({ done: 0, total: pendingIndices.length });

    setSlots((prev) =>
      prev.map((s, i) =>
        pendingIndices.includes(i) && s.pendingFile
          ? { ...s, status: 'uploading' as SlotStatus, errorMessage: undefined }
          : s,
      ),
    );

    let firstError: string | null = null;
    let doneCount = 0;
    for (const idx of pendingIndices) {
      const slot = slots[idx];
      if (!slot.pendingFile) continue;
      try {
        const { url } = await uploadSinglePhoto({
          storeKey,
          storeName,
          type,
          periodKey,
          idx,
          file: slot.pendingFile,
        });
        setSlots((prev) =>
          prev.map((s, i) =>
            i === idx
              ? { url, status: 'uploaded' as SlotStatus, pendingFile: null }
              : s,
          ),
        );
      } catch (e) {
        console.error('upload failed:', e);
        const msg = explainError(e);
        if (!firstError) firstError = msg;
        setSlots((prev) =>
          prev.map((s, i) =>
            i === idx
              ? { ...s, status: 'failed' as SlotStatus, errorMessage: msg }
              : s,
          ),
        );
      } finally {
        doneCount += 1;
        setProgress({ done: doneCount, total: pendingIndices.length });
      }
    }

    setUploading(false);
    setBannerError(firstError);

    setSlots((current) => {
      const allDone = current.every((s) => s.status === 'uploaded');
      if (allDone && !completedShown) {
        setCompletedShown(true);
        setTimeout(() => setCompletedShown(false), 2000);
      }
      return current;
    });
  };

  const uploadedCount = slots.filter((s) => s.status === 'uploaded').length;
  const capturedCount = slots.filter((s) => s.status === 'captured').length;
  const failedCount = slots.filter((s) => s.status === 'failed').length;
  const allDone = uploadedCount === total;

  let buttonLabel = 'アップロード';
  let buttonDisabled = false;
  if (uploading) {
    buttonLabel = `アップロード中… ${progress.done}/${progress.total}`;
    buttonDisabled = true;
  } else if (capturedCount + failedCount === 0) {
    buttonLabel = allDone ? 'すべて送信済み' : '撮影してください';
    buttonDisabled = true;
  } else if (failedCount > 0 && capturedCount === 0) {
    buttonLabel = `${failedCount}枚を再アップロード`;
  } else {
    buttonLabel = `${capturedCount + failedCount}枚をアップロード`;
  }

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

      <main className="flex-1 px-4 py-5 flex flex-col gap-5 pb-32">
        <div className="card p-4">
          <h2 className="font-display text-base font-extrabold">{storeName}</h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">{meta.description}</p>
          <div className="flex items-center justify-between mt-4">
            <span className="label !mb-0">アップロード済み</span>
            <span className="font-mono text-base font-bold tabular-nums">
              {uploadedCount}<span className="text-text-muted"> / {total}</span>
            </span>
          </div>
          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${type === 'daily' ? 'bg-accent' : 'bg-blue-500'} transition-all`}
              style={{ width: `${(uploadedCount / total) * 100}%` }}
            />
          </div>
          {capturedCount > 0 ? (
            <p className="text-[11px] text-warn mt-3 leading-relaxed">
              撮影済み（未送信）: {capturedCount}枚 — 下のボタンを押して送信してください。
            </p>
          ) : null}
        </div>

        {hydrating ? (
          <p className="text-center text-text-muted text-sm py-4">読み込み中…</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {slots.map((slot, idx) => (
              <PhotoSlot
                key={idx}
                index={idx}
                imageUrl={slot.url}
                status={slot.status}
                onCapture={handleCapture(idx)}
                disabled={uploading}
                label={slotLabelFor(type, idx)}
                mode={slotInputMode(type, idx)}
              />
            ))}
          </div>
        )}

        {bannerError || failedCount > 0 ? (
          <div className="text-sm text-ng bg-ng-bg rounded-xl px-3 py-2.5 font-medium space-y-1.5">
            <p className="font-bold">{failedCount}枚の送信に失敗しました</p>
            {bannerError ? (
              <p className="text-xs leading-relaxed font-normal">{bannerError}</p>
            ) : null}
            <p className="text-xs leading-relaxed font-normal opacity-90">
              対処後、もう一度アップロードボタンを押してください。
            </p>
          </div>
        ) : null}
      </main>

      <div className="sticky bottom-0 z-20 bg-surface/95 backdrop-blur border-t border-border px-4 py-3 safe-bottom">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="btn-ghost px-4 py-3 text-sm flex-shrink-0"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={buttonDisabled}
            className="btn-primary flex-1 py-3 text-base"
          >
            {buttonLabel}
          </button>
        </div>
      </div>

      <SuccessOverlay visible={completedShown} subtitle={`全${total}枚を送信しました`} />
    </div>
  );
};
