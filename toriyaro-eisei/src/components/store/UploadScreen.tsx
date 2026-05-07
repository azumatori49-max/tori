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
import { confirmCheck, undoCheck, uploadSinglePhoto } from '../../hooks/useSubmissions';
import { slotCountFor, slotIsPhoto, slotLabelFor } from '../../data/slotLabels';
import type { ReportType, StoreKey, Submission } from '../../types';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot, type SlotStatus } from '../ui/PhotoSlot';
import { CheckSlot } from '../ui/CheckSlot';
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
    description: '各項目を確認してタップ。防犯カメラのみ写真撮影が必要です。',
  },
};

interface PhotoSlotState {
  kind: 'photo';
  url: string | null;
  status: SlotStatus;
  pendingFile: File | null;
}

interface CheckSlotState {
  kind: 'check';
  checkedAt: string | null;
  busy: boolean;
}

type SlotState = PhotoSlotState | CheckSlotState;

const buildEmptySlots = (type: ReportType): SlotState[] => {
  const total = slotCountFor(type);
  return Array.from({ length: total }, (_, i): SlotState =>
    slotIsPhoto(type, i)
      ? { kind: 'photo', url: null, status: 'empty', pendingFile: null }
      : { kind: 'check', checkedAt: null, busy: false },
  );
};

const hydrateSlots = (type: ReportType, existing: Submission | null): SlotState[] => {
  const total = slotCountFor(type);
  const photos = existing?.photos ?? [];
  const checks = existing?.checks ?? {};
  return Array.from({ length: total }, (_, i): SlotState => {
    if (slotIsPhoto(type, i)) {
      const url = photos[i] ?? null;
      return {
        kind: 'photo',
        url,
        status: url ? 'uploaded' : 'empty',
        pendingFile: null,
      };
    }
    const checkedAt = checks[String(i)] ?? null;
    return { kind: 'check', checkedAt, busy: false };
  });
};

export const UploadScreen = ({ storeKey, storeName, type, onBack }: Props) => {
  const meta = META[type];
  const total = slotCountFor(type);
  const [slots, setSlots] = useState<SlotState[]>(() => buildEmptySlots(type));
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
    setSlots(buildEmptySlots(type));
    authReady
      .then(() => get(ref(db, `submissions/${storeKey}/${type}/${periodKey}`)))
      .then((snap) => {
        if (cancelled) return;
        const existing = snap.val() as Submission | null;
        setSlots(hydrateSlots(type, existing));
      })
      .catch((err) => console.error('hydrate failed:', err))
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeKey, type, periodKey]);

  const completedCount = slots.filter((s) =>
    s.kind === 'photo' ? s.status === 'uploaded' : !!s.checkedAt,
  ).length;
  const inflight = slots.filter(
    (s) => (s.kind === 'photo' && s.status === 'uploading') || (s.kind === 'check' && s.busy),
  ).length;
  const failed = slots.filter((s) => s.kind === 'photo' && s.status === 'failed').length;
  const allDone = completedCount === total;

  const maybeShowSuccess = () => {
    if (!completedShown) {
      setCompletedShown(true);
      setTimeout(() => setCompletedShown(false), 2000);
    }
  };

  const uploadAt = async (idx: number, file: File) => {
    setSlots((prev) =>
      prev.map((s, i) =>
        i === idx && s.kind === 'photo'
          ? { ...s, status: 'uploading', pendingFile: file }
          : s,
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
        const next = prev.map((s, i): SlotState =>
          i === idx && s.kind === 'photo'
            ? { kind: 'photo', url, status: 'uploaded', pendingFile: null }
            : s,
        );
        const done = next.every((s) =>
          s.kind === 'photo' ? s.status === 'uploaded' : !!s.checkedAt,
        );
        if (done) maybeShowSuccess();
        return next;
      });
    } catch (e) {
      console.error('upload failed:', e);
      setSlots((prev) =>
        prev.map((s, i): SlotState =>
          i === idx && s.kind === 'photo'
            ? { ...s, status: 'failed', pendingFile: file }
            : s,
        ),
      );
    }
  };

  const toggleCheck = async (idx: number, next: boolean) => {
    setSlots((prev) =>
      prev.map((s, i) =>
        i === idx && s.kind === 'check' ? { ...s, busy: true } : s,
      ),
    );
    try {
      if (next) {
        const { timestamp } = await confirmCheck({
          storeKey,
          storeName,
          type,
          periodKey,
          idx,
        });
        setSlots((prev) => {
          const updated = prev.map((s, i): SlotState =>
            i === idx && s.kind === 'check'
              ? { kind: 'check', checkedAt: timestamp, busy: false }
              : s,
          );
          const done = updated.every((s) =>
            s.kind === 'photo' ? s.status === 'uploaded' : !!s.checkedAt,
          );
          if (done) maybeShowSuccess();
          return updated;
        });
      } else {
        await undoCheck({ storeKey, storeName, type, periodKey, idx });
        setSlots((prev) =>
          prev.map((s, i): SlotState =>
            i === idx && s.kind === 'check'
              ? { kind: 'check', checkedAt: null, busy: false }
              : s,
          ),
        );
      }
    } catch (e) {
      console.error('check toggle failed:', e);
      setSlots((prev) =>
        prev.map((s, i) =>
          i === idx && s.kind === 'check' ? { ...s, busy: false } : s,
        ),
      );
    }
  };

  const handleCapture = (idx: number) => (file: File) => {
    void uploadAt(idx, file);
  };
  const handleRetry = (idx: number) => () => {
    const slot = slots[idx];
    if (slot.kind !== 'photo') return;
    if (slot.pendingFile) void uploadAt(idx, slot.pendingFile);
  };
  const handleToggle = (idx: number) => (next: boolean) => {
    void toggleCheck(idx, next);
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
            <span className="label !mb-0">完了</span>
            <span className="font-mono text-base font-bold tabular-nums">
              {completedCount}<span className="text-text-muted"> / {total}</span>
            </span>
          </div>
          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full ${type === 'daily' ? 'bg-accent' : 'bg-blue-500'} transition-all`}
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
            撮影・確認はその場で送信されます。途中で画面を閉じても、続きから再開できます。
          </p>
        </div>

        {hydrating ? (
          <p className="text-center text-text-muted text-sm py-4">読み込み中…</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {slots.map((slot, idx) => {
              const label = slotLabelFor(type, idx);
              if (slot.kind === 'photo') {
                return (
                  <PhotoSlot
                    key={idx}
                    index={idx}
                    imageUrl={slot.url}
                    status={slot.status}
                    onCapture={handleCapture(idx)}
                    onRetry={slot.status === 'failed' ? handleRetry(idx) : undefined}
                    label={label}
                  />
                );
              }
              return (
                <CheckSlot
                  key={idx}
                  index={idx}
                  label={label}
                  checkedAt={slot.checkedAt}
                  busy={slot.busy}
                  onToggle={handleToggle(idx)}
                />
              );
            })}
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
              ? `処理中… ${inflight}件`
              : allDone
                ? `${total}項目すべて完了しました`
                : `あと ${total - completedCount} 件`}
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

      <SuccessOverlay visible={completedShown} subtitle={`${total}項目すべて完了しました`} />
    </div>
  );
};
