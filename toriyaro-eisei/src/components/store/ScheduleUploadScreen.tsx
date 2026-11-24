import { useEffect, useMemo, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { PhotoSlot } from '../ui/PhotoSlot';
import { VideoSlot } from '../ui/VideoSlot';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import { Lightbox } from '../ui/Lightbox';
import { InlineVideo } from '../ui/InlineVideo';
import { useSchedules } from '../../hooks/useSchedules';
import {
  VIDEO_MAX_LABEL,
  submitSlots,
  useStoreSubmissionStatus,
  type SubmitSlot,
} from '../../hooks/useSubmissions';
import { getDateKey } from '../../lib/dateUtils';
import {
  formatScheduleRange,
  itemsForStore,
  photosMap,
  scheduleItems,
  scheduleStatus,
  slotRanges,
  totalMax,
} from '../../lib/schedule';
import type { StoreKey } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  scheduleId: string;
  onBack: () => void;
}

type SlotState =
  | { kind: 'empty' }
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File };

const makeEmptySlots = (n: number): SlotState[] =>
  Array.from({ length: n }, () => ({ kind: 'empty' }));

const slotToSubmit = (s: SlotState): SubmitSlot => {
  if (s.kind === 'existing') return { kind: 'existing', url: s.url };
  if (s.kind === 'new') return { kind: 'new', file: s.file };
  return { kind: 'empty' };
};

/**
 * 年間スケジュール専用の提出画面。
 * 日々の提出（UploadScreen）には影響させないため別画面。
 * 保存先は既存の weekly と同じ場所（submissions/{store}/weekly/{scheduleId}）。
 */
export const ScheduleUploadScreen: FC<Props> = ({ storeKey, storeName, scheduleId, onBack }) => {
  const { schedules, loading: schedulesLoading } = useSchedules();
  const schedule = schedules[scheduleId] ?? null;
  const items = useMemo(() => scheduleItems(schedule), [schedule]);
  // 番号（ranges / slotCount）は全項目で通し。画面にはこの店舗に表示する項目だけを出す
  const ranges = useMemo(() => slotRanges(items), [items]);
  const slotCount = totalMax(items);
  const visibleItems = useMemo(() => itemsForStore(items, storeKey), [items, storeKey]);

  const { submission: existing, loading } = useStoreSubmissionStatus(
    storeKey,
    'weekly',
    scheduleId,
  );

  const [slots, setSlots] = useState<SlotState[]>([]);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progressState, setProgressState] = useState<{ uploaded: number; total: number } | null>(null);
  /** 送信中の動画の進み具合（%）。写真のときは null */
  const [bytesPct, setBytesPct] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpImageUrl, setHelpImageUrl] = useState<string | null>(null);

  const stateKey = `${scheduleId}:${slotCount}`;

  useEffect(() => {
    if (loading || slotCount === 0) return;
    if (hydratedKey === stateKey) return;
    const photos = photosMap((existing as { photos?: unknown } | null)?.photos);
    const next = makeEmptySlots(slotCount);
    for (let i = 0; i < slotCount; i += 1) {
      const url = photos.get(i);
      if (url) next[i] = { kind: 'existing', url };
    }
    setSlots(next);
    setHydratedKey(stateKey);
  }, [loading, hydratedKey, stateKey, existing, slotCount]);

  useEffect(() => {
    if (success) {
      const t = window.setTimeout(() => {
        setSuccess(false);
        onBack();
      }, 1400);
      return () => window.clearTimeout(t);
    }
  }, [success, onBack]);

  const newCount = useMemo(() => slots.filter((s) => s.kind === 'new').length, [slots]);
  const hasExisting = useMemo(() => slots.some((s) => s.kind === 'existing'), [slots]);

  const todayKey = getDateKey();
  const ended = !!schedule && scheduleStatus(schedule, todayKey) === 'ended';
  const canSubmit = newCount > 0 && !submitting && !ended && !!schedule;

  const setSlotFile = (idx: number, file: File) => {
    setError(null);
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { kind: 'new', file };
      return next;
    });
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    setProgressState({ uploaded: 0, total: newCount });
    try {
      await submitSlots({
        storeKey,
        storeName,
        type: 'weekly',
        dateOrWeekKey: scheduleId,
        slots: slots.map(slotToSubmit),
        onProgress: (uploaded, total) => {
          setProgressState({ uploaded, total });
          setBytesPct(null);
        },
        onBytes: (loaded, total) =>
          setBytesPct(total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : null),
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('アップロード失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
      setProgressState(null);
      setBytesPct(null);
    }
  };

  const submitLabel = ended
    ? '受付は終了しました'
    : submitting
      ? '送信中…'
      : newCount === 0
        ? hasExisting
          ? '変更がありません'
          : '写真を選択してください'
        : hasExisting
          ? `${newCount}枚を更新する`
          : `${newCount}枚を提出する`;

  const back = (
    <button type="button" onClick={onBack} className="text-lg text-text-muted hover:text-accent" aria-label="戻る">
      ←
    </button>
  );

  if (!schedule) {
    return (
      <div className="min-h-screen bg-bg">
        <AppHeader title="年間スケジュール" subtitle={storeName} left={back} />
        <main className="mx-auto w-full max-w-app px-4 py-8 text-center text-sm text-text-muted">
          {schedulesLoading ? '読み込み中…' : 'このスケジュールは見つかりませんでした（削除された可能性があります）'}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-32">
      <AppHeader title={schedule.title} subtitle={storeName} left={back} />
      <main className="mx-auto w-full max-w-app px-4 py-5">
        {/* ヘッダーでは長いタイトルを「…」で省略するので、本文の先頭に省略なしで出す */}
        <h2 className="mb-3 text-base font-bold leading-snug text-text">{schedule.title}</h2>
        <div className="mb-3 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">
          <span className="font-bold">期間 {formatScheduleRange(schedule.from, schedule.to)}</span>
          {ended && <p className="mt-1">この依頼の受付は終了しました（確認のみ可能）。</p>}
        </div>
        {schedule.description && (
          <p className="whitespace-pre-wrap text-sm text-text">{schedule.description}</p>
        )}
        {schedule.video && (
          <section className="mt-3 rounded-2xl border border-accent/40 bg-accent/5 p-2.5">
            <p className="mb-1.5 text-xs font-bold text-accent">参考動画</p>
            <InlineVideo video={schedule.video} />
          </section>
        )}
        {hasExisting && !ended && (
          <div className="mt-3 rounded-xl border border-ok/30 bg-ok-bg/60 px-3 py-2 text-xs font-bold text-ok">
            提出済みの写真が表示されています。撮り直したい枠をタップしてください。
          </div>
        )}

        {loading && slots.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>
        ) : (
          visibleItems.map(({ item, index: itemIdx }, visibleIdx) => {
            const range = ranges[itemIdx];
            const displayNo = visibleIdx + 1;
            const filled = slots
              .slice(range.start, range.end)
              .filter((s) => s.kind !== 'empty').length;
            return (
              <section key={itemIdx} className="mt-5">
                <h3 className="text-sm font-bold">
                  {displayNo}. {item.label}
                  <span className="ml-2 text-[11px] font-normal text-text-muted">
                    {item.source === 'video'
                      ? `動画 必要${item.required}本／最大${item.max}本（1本${VIDEO_MAX_LABEL}まで）`
                      : `必要${item.required}枚／最大${item.max}枚`}
                  </span>
                </h3>
                {item.video && (
                  <div className="mt-1.5 rounded-xl border border-accent/40 bg-accent/5 p-2">
                    <p className="mb-1 text-[11px] font-bold text-accent">参考動画</p>
                    <InlineVideo video={item.video} />
                  </div>
                )}
                {item.note && <p className="mt-0.5 text-[11px] text-warn">{item.note}</p>}
                {item.helpImage && (
                  <button
                    type="button"
                    onClick={() => setHelpImageUrl(item.helpImage ?? null)}
                    className="mt-1 inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-2 py-1 text-[11px] font-bold text-accent active:scale-95"
                  >
                    <img src={item.helpImage} alt="" className="h-10 w-10 rounded object-cover" />
                    参考写真を見る
                  </button>
                )}
                <p className="mt-0.5 text-[11px] text-text-muted">
                  撮影済み {filled}{item.source === 'video' ? '本' : '枚'}
                  {filled >= item.required
                    ? '（OK）'
                    : `（あと${item.required - filled}${item.source === 'video' ? '本' : '枚'}）`}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {slots.slice(range.start, range.end).map((slot, j) => {
                    const idx = range.start + j;
                    const optional = j >= item.required;
                    return (
                      <div key={idx} className="flex flex-col gap-1">
                        {item.source === 'video' ? (
                          <VideoSlot
                            index={j}
                            file={slot.kind === 'new' ? slot.file : null}
                            existingUrl={slot.kind === 'existing' ? slot.url : undefined}
                            onPick={(f) => setSlotFile(idx, f)}
                            disabled={submitting || ended}
                          />
                        ) : (
                          <PhotoSlot
                            index={j}
                            file={slot.kind === 'new' ? slot.file : null}
                            existingUrl={slot.kind === 'existing' ? slot.url : undefined}
                            onPick={(f) => setSlotFile(idx, f)}
                            disabled={submitting || ended}
                            source={item.source}
                          />
                        )}
                        <div className="px-1 text-center text-[11px] font-bold leading-tight text-text-muted">
                          {optional ? '任意' : `${j + 1}${item.source === 'video' ? '本目' : '枚目'}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-ng-bg px-3 py-2 text-xs font-bold text-ng">{error}</p>
        )}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto w-full max-w-app px-4 py-3">
          {progressState && (
            <div className="mb-2">
              <div className="flex justify-between text-[11px] font-bold text-text-muted">
                <span>
                  アップロード中…
                  {bytesPct !== null && <span className="ml-1">（動画 {bytesPct}%）</span>}
                </span>
                <span>
                  {progressState.uploaded} / {progressState.total}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${
                      ((progressState.uploaded + (bytesPct !== null ? bytesPct / 100 : 0)) /
                        progressState.total) *
                      100
                    }%`,
                  }}
                />
              </div>
              {bytesPct !== null && (
                <p className="mt-1 text-[10px] text-text-muted">
                  動画の送信中は画面を閉じないでください。
                </p>
              )}
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
