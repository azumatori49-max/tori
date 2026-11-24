import { isMorningLocked } from '../../lib/morningLock';
import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot } from '../ui/PhotoSlot';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import { Lightbox } from '../ui/Lightbox';
import {
  submitSlots,
  useStoreSubmissionStatus,
  type SubmitSlot,
} from '../../hooks/useSubmissions';
import { itemsForType, targetForType } from '../../data/checkItems';
import {
  getDateKey,
  getWeekKey,
  getMonthKey,
  formatDateKeyShort,
  formatWeekKeyRange,
  formatMonthKeyJa,
  isPivotActive,
} from '../../lib/dateUtils';
import type { ReportType, StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  onBack: () => void;
}

type SlotState =
  | { kind: 'empty' }
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File };

const sparsePhotosFromSubmission = (raw: unknown): Map<number, string> => {
  const result = new Map<number, string>();
  if (!raw) return result;
  if (Array.isArray(raw)) {
    raw.forEach((v, i) => {
      if (typeof v === 'string' && v.length > 0) result.set(i, v);
    });
    return result;
  }
  if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
      const idx = Number(k);
      if (Number.isInteger(idx) && idx >= 0 && typeof v === 'string' && v.length > 0) {
        result.set(idx, v);
      }
    });
  }
  return result;
};

const makeEmptySlots = (n: number): SlotState[] =>
  Array.from({ length: n }, () => ({ kind: 'empty' }));

const slotToSubmit = (s: SlotState): SubmitSlot => {
  if (s.kind === 'existing') return { kind: 'existing', url: s.url };
  if (s.kind === 'new') return { kind: 'new', file: s.file };
  return { kind: 'empty' };
};

export const UploadScreen: FC<Props> = ({ storeKey, storeName, type, onBack }) => {
  const defaultKey = useMemo(
    () =>
      type === 'daily' ? getDateKey() : type === 'weekly' ? getWeekKey() : getMonthKey(),
    [type],
  );
  const dateOrWeekKey = defaultKey;

  // 指定店舗のみ AM6:00〜8:59 はデイリーの編集を締め切り、確認のみ可能にする
  const morningLock = type === 'daily' && isMorningLocked(storeKey);

  const { submission: existing, loading } = useStoreSubmissionStatus(
    storeKey,
    type,
    dateOrWeekKey,
  );

  const TARGET = targetForType(type, storeKey, dateOrWeekKey);
  const ITEMS = itemsForType(type, storeKey, dateOrWeekKey);

  const lastItem = ITEMS[ITEMS.length - 1];
  const hasMulti = !!lastItem?.multi;
  const fixedItems = hasMulti ? ITEMS.slice(0, -1) : ITEMS;
  const multiItem = hasMulti ? lastItem : null;
  const fixedCount = fixedItems.length;

  const [fixedSlots, setFixedSlots] = useState<SlotState[]>(() => makeEmptySlots(fixedCount));
  const [multiSlots, setMultiSlots] = useState<SlotState[]>([]);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ uploaded: number; total: number } | null>(null);
  // 送信中の1枚の進み具合（0〜100）
  const [bytesPct, setBytesPct] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpImageUrl, setHelpImageUrl] = useState<string | null>(null);
  // 複数枚OKの項目で「×」で外した、保存済み写真のURL（提出時にまとめて外す）
  const removedUrlsRef = useRef<string[]>([]);
  const multiInputRef = useRef<HTMLInputElement>(null);

  const stateKey = `${type}:${dateOrWeekKey}`;

  useEffect(() => {
    if (loading) return;
    if (hydratedKey === stateKey) return;
    const photos = sparsePhotosFromSubmission(
      (existing as { photos?: unknown } | null)?.photos,
    );
    const nextFixed = makeEmptySlots(fixedCount);
    for (let i = 0; i < fixedCount; i += 1) {
      const url = photos.get(i);
      if (url) nextFixed[i] = { kind: 'existing', url };
    }
    setFixedSlots(nextFixed);
    const nextMulti: SlotState[] = [];
    if (hasMulti) {
      // 途中の番号が抜けていても、その後ろの写真を落とさない（抜けは空き枠として持つ）
      let i = fixedCount;
      const end = Math.min(20, Math.max(fixedCount, ...photos.keys()) + 1);
      while (i < end) {
        const url = photos.get(i);
        nextMulti.push(url ? { kind: 'existing', url } : { kind: 'empty' });
        i += 1;
      }
    }
    setMultiSlots(nextMulti);
    removedUrlsRef.current = [];
    setHydratedKey(stateKey);
  }, [loading, hydratedKey, stateKey, existing, fixedCount, hasMulti]);

  useEffect(() => {
    setHydratedKey(null);
    setFixedSlots(makeEmptySlots(fixedCount));
    setMultiSlots([]);
  }, [fixedCount, type, dateOrWeekKey]);

  useEffect(() => {
    if (success) {
      const t = window.setTimeout(() => {
        setSuccess(false);
        onBack();
      }, 1400);
      return () => window.clearTimeout(t);
    }
  }, [success, onBack]);

  const filledCount = useMemo(
    () =>
      fixedSlots.filter((s) => s.kind !== 'empty').length +
      multiSlots.filter((s) => s.kind !== 'empty').length,
    [fixedSlots, multiSlots],
  );
  const newCount = useMemo(
    () =>
      fixedSlots.filter((s) => s.kind === 'new').length +
      multiSlots.filter((s) => s.kind === 'new').length,
    [fixedSlots, multiSlots],
  );
  const hasExisting = useMemo(
    () =>
      fixedSlots.some((s) => s.kind === 'existing') ||
      multiSlots.some((s) => s.kind === 'existing'),
    [fixedSlots, multiSlots],
  );
  const canSubmit = newCount > 0 && !submitting && !morningLock;

  const setFixedSlotFile = (idx: number, file: File) => {
    setError(null);
    setFixedSlots((prev) => {
      const next = [...prev];
      next[idx] = { kind: 'new', file };
      return next;
    });
  };

  const addMultiFiles = (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setMultiSlots((prev) => {
      const next = [...prev];
      for (const file of files) {
        // 空き枠があればそこに入れ、無ければ後ろに足す（合計20枚まで）
        const emptyIdx = next.findIndex((s) => s.kind === 'empty');
        if (emptyIdx >= 0) next[emptyIdx] = { kind: 'new', file };
        else if (fixedCount + next.length < 20) next.push({ kind: 'new', file });
      }
      return next;
    });
  };

  const replaceMultiSlot = (idx: number, file: File) => {
    setError(null);
    setMultiSlots((prev) => {
      const next = [...prev];
      next[idx] = { kind: 'new', file };
      return next;
    });
  };

  const removeMultiSlot = (idx: number) => {
    // 番号を詰めると他の写真の番号がずれるので、外した枠は空き枠として残す
    const target = multiSlots[idx];
    if (target.kind === 'existing') removedUrlsRef.current.push(target.url);
    setMultiSlots((prev) => prev.map((s, i) => (i === idx ? { kind: 'empty' } : s)));
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    setProgress({ uploaded: 0, total: newCount });
    setBytesPct(0);
    try {
      const payload: SubmitSlot[] = [
        ...fixedSlots.map(slotToSubmit),
        ...multiSlots.map(slotToSubmit),
      ];
      await submitSlots({
        storeKey,
        storeName,
        type,
        dateOrWeekKey,
        slots: payload,
        removedPhotoUrls: removedUrlsRef.current,
        onProgress: (uploaded, total) => {
          setProgress({ uploaded, total });
          setBytesPct(0);
        },
        onBytes: (loaded, total) => setBytesPct(total > 0 ? Math.min(100, (loaded / total) * 100) : 0),
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('アップロード失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  };

  const submitLabel = morningLock
    ? '確認のみ可能（AM9:00まで編集不可）'
    : submitting
      ? '送信中…'
      : newCount === 0
        ? hasExisting ? '変更がありません' : '写真を選択してください'
        : hasExisting ? `${newCount}枚を送信する` : `${newCount}枚を提出する`;

  return (
    <div className="min-h-screen bg-bg pb-32">
      <AppHeader
        title={type === 'daily' ? '毎日の衛生チェック' : type === 'weekly' ? '週次の衛生チェック' : '月次の衛生チェック'}
        subtitle={storeName}
        left={
          <button type="button" onClick={onBack} disabled={submitting} className="-ml-2 inline-flex h-11 w-11 items-center justify-center text-lg text-text-muted hover:text-accent disabled:opacity-40" aria-label="戻る">←</button>
        }
      />
      <main className="mx-auto w-full max-w-app px-4 py-5">
        <div className="mb-3 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">
          <span className="font-bold">
            {type === 'daily'
              ? `${formatDateKeyShort(dateOrWeekKey)} 分`
              : type === 'weekly'
                ? `週 ${formatWeekKeyRange(dateOrWeekKey)}`
                : `${formatMonthKeyJa(dateOrWeekKey)} 分`} として提出されます
          </span>
          {isPivotActive() && (
            <p className="mt-1">（現在 9 時前のため業務日は前日扱い）</p>
          )}
        </div>
        {morningLock && (
          <div className="mb-3 rounded-lg bg-surface2 px-3 py-2 text-xs font-bold text-text-muted">
            AM6:00〜9:00 は前日分の締め切り時間のため、確認のみ可能です（編集不可）。9:00から新しい営業日の提出ができます。
          </div>
        )}
        <p className="text-sm text-text-muted">
          {type === 'daily'
            ? `本日分の衛生チェック写真を ${TARGET}枚撮影してください。`
            : type === 'weekly'
              ? `今週分の衛生チェック写真を撮影してください。`
              : `今月分のモップ交換写真を撮影してください（月内のいつでもOK）。`}
          <br />まとめても、何回かに分けて送信してもOKです。
        </p>
        {hasExisting && !morningLock && (
          <div className="mt-3 rounded-xl border border-ok/30 bg-ok-bg/60 px-3 py-2 text-xs font-bold text-ok">
            提出済みの写真が表示されています。撮り直したい枠をタップしてください。
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-xs font-bold">
          <span className="text-text-muted">撮影済み <span className="text-base text-text">{filledCount}</span>枚</span>
          {newCount > 0 && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">
              未送信 {newCount}枚
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fixedSlots.map((slot, i) => {
            const item = fixedItems[i];
            return (
              <PhotoSlot
                key={i}
                index={i}
                file={slot.kind === 'new' ? slot.file : null}
                existingUrl={slot.kind === 'existing' ? slot.url : undefined}
                onPick={(f) => setFixedSlotFile(i, f)}
                disabled={submitting || morningLock}
                label={item?.label}
                source={item?.source ?? 'camera'}
                note={item?.note}
                helpImage={item?.helpImage}
                onHelpClick={setHelpImageUrl}
              />
            );
          })}
        </div>
        {multiItem && (
          <section className="mt-6">
            <h3 className="mb-2 text-sm font-bold">
              {fixedCount + 1}. {multiItem.label}
              <span className="ml-2 text-xs font-normal text-text-muted">（複数枚OK）</span>
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {multiSlots.map((slot, i) =>
                slot.kind === 'empty' ? null : (
                  <MultiCell
                    key={i}
                    index={i}
                    slot={slot}
                    source={multiItem.source}
                    disabled={submitting || morningLock}
                    onReplace={(f) => replaceMultiSlot(i, f)}
                    onRemove={() => removeMultiSlot(i)}
                  />
                ),
              )}
              <button
                type="button"
                onClick={() => multiInputRef.current?.click()}
                disabled={
                  submitting ||
                  morningLock ||
                  fixedCount + multiSlots.filter((s) => s.kind !== 'empty').length >= 20
                }
                className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent/60 bg-accent/5 text-accent transition active:scale-95 disabled:opacity-50"
              >
                <span className="text-2xl">＋</span>
                <span className="text-xs font-bold">追加</span>
              </button>
              <input
                ref={multiInputRef}
                type="file"
                accept="image/*"
                multiple
                {...(multiItem.source === 'camera' ? { capture: 'environment' as const } : {})}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) addMultiFiles(files);
                  e.target.value = '';
                }}
              />
            </div>
            {multiSlots.length === 0 && (
              <p className="mt-2 text-xs text-text-muted">
                「＋追加」から写真を選択してください（一度に複数選択可）
              </p>
            )}
          </section>
        )}
        {!morningLock && (
          <p className="mt-4 text-xs text-text-muted">
            {fixedSlots.filter((s) => s.kind === 'empty').length > 0
              ? `未撮影の項目はあと${fixedSlots.filter((s) => s.kind === 'empty').length}件です。撮影できた分だけでも提出できます。`
              : 'すべての項目の写真がそろっています。'}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-ng-bg px-3 py-2 text-xs font-bold text-ng">{error}</p>
        )}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto w-full max-w-app px-4 py-3">
          {progress && (
            <div className="mb-2" role="status" aria-live="polite">
              <div className="flex justify-between text-xs font-bold text-text-muted">
                <span>{progress.uploaded === progress.total ? '保存を確認中…' : '写真を送信中…'}</span>
                <span>{progress.uploaded} / {progress.total}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2">
                <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, ((progress.uploaded + bytesPct / 100) / progress.total) * 100)}%` }} />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            data-busy={submitting ? '' : undefined}
            className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99]"
          >
            {submitLabel}
          </button>
        </div>
      </div>
      <SuccessOverlay open={success} message={hasExisting ? '更新完了!' : '提出完了!'} />
      <Lightbox url={helpImageUrl} onClose={() => setHelpImageUrl(null)} />
    </div>
  );
};

interface MultiCellProps {
  index: number;
  slot: SlotState;
  source: 'camera' | 'library';
  disabled?: boolean;
  onReplace: (file: File) => void;
  onRemove: () => void;
}

const MultiCell: FC<MultiCellProps> = ({ index, slot, source, disabled, onReplace, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (slot.kind !== 'new') {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(slot.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [slot]);

  const displayUrl = preview ?? (slot.kind === 'existing' ? slot.url : null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled}
        className="relative aspect-square w-full overflow-hidden rounded-2xl border-2 border-border bg-surface transition active:scale-95"
      >
        {displayUrl ? (
          <img src={displayUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">#{index + 1}</div>
        )}
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="tap-target-sm absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ng text-white shadow disabled:opacity-50"
        aria-label="削除"
      >
        ×
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(source === 'camera' ? { capture: 'environment' as const } : {})}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onReplace(f);
          e.target.value = '';
        }}
      />
    </div>
  );
};