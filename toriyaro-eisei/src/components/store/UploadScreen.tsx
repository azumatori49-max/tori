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
    description: '所定の項目を撮影してください。撮影した写真は自動で順次保存されます。',
  },
  weekly: {
    title: 'ウィークリー衛生チェック',
    description: '7項目はカメラで撮影、防犯カメラのみ写真フォルダから選択して提出してください。',
  },
};

interface SlotState {
  url: string | null;
  status: SlotStatus;
  pendingFile: File | null;
}

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

  const uploadedCount = slots.filter((s) => s.status === 'uploaded').length;
  const inflight = slots.filter((s) => s.status === 'uploading').length;
  const failed = slots.filter((s) => s.status === 'failed').length;
  const allDone = uploadedCount === total;

  const uploadAt = async (idx: number, file: File) => {
    setSlots((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, status: 'uploading', pendingFile: file } : s,
      ),
    );
    try {
      const { url } = await uploadSinglePhoto({
        storeKey,
        storeName,
        type,
        periodKey,
        idx,
        file,
      });
      setSlots((prev) => {
        const next = prev.map((s, i) =>
          i === idx ? { url, status: 'uploaded' as SlotStatus, pendingFile: null } : s,
        );
        if (next.every((s) => s.status === 'uploaded') && !completedShown) {
          setCompletedShown(true);
          setTimeout(() => setCompletedShown(false), 2000);
        }
        return next;
      });
    } catch (e) {
      console.error('upload failed:', e);
      setSlots((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, status: 'failed' as SlotStatus, pendingFile: file } : s,
        ),
      );
    }
  };

  const handleCapture = (idx: number) => (file: File) => {
    void uploadAt(idx, file);
  };
  const handleRetry = (idx: number) => () => {
    const file = slots[idx].pendingFile;
    if (file) void uploadAt(idx, file);
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
          <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
            撮影した写真はその場で送信されます。途中で画面を閉じても、続きから再開できます。
          </p>
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
                onRetry={slot.status === 'failed' ? handleRetry(idx) : undefined}
                label={slotLabelFor(type, idx)}
                mode={slotInputMode(type, idx)}
              />
            ))}
          </div>
        )}

        {failed > 0 ? (
          <div className="text-sm text-ng bg-ng-bg rounded-xl px-3 py-2 font-medium">
            {failed}枚の送信に失敗しました。失敗マークが付いたスロットをタップして再試行してください。
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 mt-1">
          <span className="text-xs text-text-muted">
            {inflight > 0
              ? `送信中… ${inflight}枚`
              : allDone
                ? `全${total}枚の送信が完了しました`
                : `あと ${total - uploadedCount} 枚`}
          </span>
          <button
            type="button"
            onClick={onBack}
            className={allDone ? 'btn-primary px-5 py-2.5 text-sm' : 'btn-ghost px-5 py-2.5 text-sm'}
          >
            {allDone ? '完了して戻る' : '途中で戻る'}
          </button>
        </div>
      </main>

      <SuccessOverlay visible={completedShown} subtitle={`全${total}枚を送信しました`} />
    </div>
  );
};
