import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { Lightbox } from '../ui/Lightbox';
import { VideoModal } from '../ui/VideoModal';
import { ScheduleItemStats, ScheduleStatsSummary } from './ScheduleStatsView';
import { SavePhotoButton, ZipSaveButton } from './PhotoSave';
import { buildPhotoFileName, sanitizeFileName, type ZipEntry } from '../../lib/download';
import {
  createSchedule,
  deleteSchedule,
  deleteScheduleMediaObject,
  newScheduleId,
  setScheduleArchived,
  updateSchedule,
  uploadScheduleMedia,
  uploadScheduleRefImage,
  useSchedules,
} from '../../hooks/useSchedules';
import { fetchSubmissionsForKey } from '../../hooks/useSubmissions';
import { formatDateTimeJa, getDateKey } from '../../lib/dateUtils';
import {
  SCHEDULE_MAX_PHOTOS,
  SCHEDULE_VIDEO_MAX_BYTES,
  SCHEDULE_VIDEO_TITLE_MAX,
  SCHEDULE_VIDEO_WARN_BYTES,
  formatScheduleRange,
  itemStats,
  itemsForStore,
  parseVideoUrl,
  photosMap,
  progress,
  sameStructure,
  scheduleItems,
  scheduleStatus,
  slotRanges,
  sourceLabel,
  targetStoreKeys,
  totalMax,
  validateScheduleInput,
  type ScheduleInput,
  type ScheduleStatus,
} from '../../lib/schedule';
import type { Schedule, ScheduleItem, ScheduleVideo, Store, StoreKey, Submission } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
}

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'detail'; id: string } | { kind: 'edit'; id: string };

const STATUS_LABEL: Record<ScheduleStatus, { label: string; cls: string }> = {
  active: { label: '期間中', cls: 'bg-ok-bg text-ok' },
  upcoming: { label: '予定', cls: 'bg-blue-50 text-blue-600' },
  ended: { label: '終了', cls: 'bg-surface2 text-text-muted' },
  archived: { label: '非表示', cls: 'bg-surface2 text-text-muted' },
};

const VIDEO_TYPE_LABEL: Record<ScheduleVideo['type'], string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  upload: 'アップロード',
};

const formatMB = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

const sortedStoreKeys = (stores: Record<StoreKey, Store>): StoreKey[] =>
  Object.keys(stores).sort((a, b) => stores[a].name.localeCompare(stores[b].name, 'ja'));

/** スケジュール1件の全対象店舗の提出データを取得する */
const useScheduleSubmissions = (
  id: string | null,
  schedule: Schedule | null,
  stores: Record<StoreKey, Store>,
) => {
  const [data, setData] = useState<Record<StoreKey, Submission | null>>({});
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(0);
  const reload = useCallback(() => setToken((t) => t + 1), []);

  const targetKeys = useMemo(
    () => (schedule ? targetStoreKeys(schedule, sortedStoreKeys(stores)) : []),
    [schedule, stores],
  );
  const targetKeysJoined = targetKeys.join(',');

  useEffect(() => {
    if (!id || targetKeys.length === 0) {
      setData({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSubmissionsForKey(targetKeys, 'weekly', id)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, targetKeysJoined, token]);

  return { data, loading, reload, targetKeys };
};

/** 提出データがあるか（写真が1枚でもある店舗があるか） */
const hasAnySubmission = (data: Record<StoreKey, Submission | null>): boolean =>
  Object.values(data).some((s) => !!s && photosMap(s.photos).size > 0);

export const ScheduleTab: FC<Props> = ({ stores }) => {
  const { schedules, loading, error } = useSchedules();
  const [rawView, setView] = useState<View>({ kind: 'list' });
  const todayKey = getDateKey();

  // 表示中のスケジュールが（別の端末などで）消えていたら一覧に戻す
  const view: View =
    (rawView.kind === 'detail' || rawView.kind === 'edit') && !schedules[rawView.id]
      ? { kind: 'list' }
      : rawView;

  const sortedIds = useMemo(
    () =>
      Object.keys(schedules).sort((a, b) => {
        const sa = schedules[a];
        const sb = schedules[b];
        return sb.from.localeCompare(sa.from) || sb.to.localeCompare(sa.to) || b.localeCompare(a);
      }),
    [schedules],
  );

  if (view.kind === 'create') {
    return (
      <ScheduleForm
        stores={stores}
        initial={null}
        locked={false}
        onCancel={() => setView({ kind: 'list' })}
        onSaved={(id) => setView({ kind: 'detail', id })}
      />
    );
  }

  if (view.kind === 'edit') {
    const s = schedules[view.id];
    return (
      <ScheduleEditLoader
        id={view.id}
        schedule={s}
        stores={stores}
        onCancel={() => setView({ kind: 'detail', id: view.id })}
        onSaved={() => setView({ kind: 'detail', id: view.id })}
      />
    );
  }

  if (view.kind === 'detail') {
    const s = schedules[view.id];
    return (
      <ScheduleDetail
        id={view.id}
        schedule={s}
        stores={stores}
        onBack={() => setView({ kind: 'list' })}
        onEdit={() => setView({ kind: 'edit', id: view.id })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-surface border border-border px-3 py-1 text-xs font-bold">
          年間スケジュール <span className="text-accent">{sortedIds.length}</span>
        </span>
        <button
          type="button"
          onClick={() => setView({ kind: 'create' })}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white"
        >
          ＋ 新規作成
        </button>
      </div>
      <p className="text-[11px] text-text-muted">
        期間つきの撮影依頼（POP張り替え、消防設備点検、大掃除など）を作ると、対象店舗の店舗トップに「撮影して提出」のカードが出ます。
        デイリー・ウィークリー・マンスリーの集計には含まれません。
      </p>
      {error && (
        <p className="rounded-lg bg-ng-bg px-3 py-2 text-xs font-bold text-ng">{error}</p>
      )}
      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>
      ) : sortedIds.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">スケジュールはまだありません</p>
      ) : (
        <ul className="space-y-2">
          {sortedIds.map((id) => (
            <ScheduleListRow
              key={id}
              id={id}
              schedule={schedules[id]}
              stores={stores}
              todayKey={todayKey}
              onOpen={() => setView({ kind: 'detail', id })}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

// ============================================================
// 一覧の1行
// ============================================================

const ScheduleListRow: FC<{
  id: string;
  schedule: Schedule;
  stores: Record<StoreKey, Store>;
  todayKey: string;
  onOpen: () => void;
}> = ({ id, schedule, stores, todayKey, onOpen }) => {
  const status = scheduleStatus(schedule, todayKey);
  const st = STATUS_LABEL[status];
  const { data, loading, targetKeys } = useScheduleSubmissions(id, schedule, stores);
  const items = scheduleItems(schedule);
  const doneCount = targetKeys.filter((k) => progress(items, data[k]?.photos, k).status === 'done').length;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{schedule.title}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
          <span>{formatScheduleRange(schedule.from, schedule.to)}</span>
          <span>
            提出 {loading ? '…' : doneCount}/{targetKeys.length}店舗
          </span>
        </div>
      </button>
    </li>
  );
};

// ============================================================
// 詳細
// ============================================================

const ScheduleDetail: FC<{
  id: string;
  schedule: Schedule;
  stores: Record<StoreKey, Store>;
  onBack: () => void;
  onEdit: () => void;
}> = ({ id, schedule, stores, onBack, onEdit }) => {
  const todayKey = getDateKey();
  const status = scheduleStatus(schedule, todayKey);
  const st = STATUS_LABEL[status];
  const { data, loading, reload, targetKeys } = useScheduleSubmissions(id, schedule, stores);
  const items = scheduleItems(schedule);
  const ranges = slotRanges(items);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState<ScheduleVideo | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'stores' | 'items'>('stores');
  const stats = useMemo(() => itemStats(schedule, data, targetKeys), [schedule, data, targetKeys]);

  const rows = targetKeys.map((k) => ({
    key: k,
    name: stores[k]?.name ?? k,
    sub: data[k] ?? null,
    p: progress(items, data[k]?.photos, k),
  }));
  const doneCount = rows.filter((r) => r.p.status === 'done').length;
  const missing = rows.filter((r) => r.p.status !== 'done');
  const locked = hasAnySubmission(data);

  const copyText = `【${schedule.title} 未提出 ${missing.length}店舗】${missing.map((r) => r.name).join('、')}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      alert('コピーできませんでした。文章を長押しして選択してください。');
    }
  };

  const handleArchive = async (archived: boolean) => {
    const msg = archived
      ? `「${schedule.title}」を非表示にしますか？\n店舗トップと一覧の「期間中」から消えます（提出データは残ります）。`
      : `「${schedule.title}」を再表示しますか？`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await setScheduleArchived(id, archived);
    } catch (err) {
      alert('更新に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (locked) return;
    if (!confirm(`「${schedule.title}」を削除しますか？\n参考動画（アップロード分）も削除されます。この操作は元に戻せません。`)) return;
    setBusy(true);
    try {
      await deleteSchedule(id);
      onBack();
    } catch (err) {
      alert('削除に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const videoChip = (v: ScheduleVideo | undefined) =>
    v ? (
      <button
        type="button"
        onClick={() => setPlaying(v)}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent"
      >
        ▶ 動画（{VIDEO_TYPE_LABEL[v.type]}）
      </button>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-lg text-text-muted hover:text-accent" aria-label="戻る">
          ←
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-bold">{schedule.title}</h2>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-3 text-xs">
        <p>
          <span className="font-bold">期間：</span>
          {formatScheduleRange(schedule.from, schedule.to)}（{schedule.from} 〜 {schedule.to}）
        </p>
        <p className="mt-1">
          <span className="font-bold">対象：</span>
          {schedule.stores ? `${targetKeys.length}店舗を選択` : '全店'}
        </p>
        {schedule.description && (
          <p className="mt-1 whitespace-pre-wrap">
            <span className="font-bold">説明：</span>
            {schedule.description}
          </p>
        )}
        {schedule.video && (
          <p className="mt-1 flex items-center gap-2">
            <span className="font-bold">参考動画：</span>
            {videoChip(schedule.video)}
            {schedule.video.title && <span className="truncate text-text-muted">{schedule.video.title}</span>}
          </p>
        )}
        <div className="mt-2 space-y-0.5">
          <p className="font-bold">項目（合計 上限{totalMax(items)}枚）</p>
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 text-text-muted">
              <p className="min-w-0 flex-1">
                {i + 1}. {it.label}（必要{it.required}／最大{it.max}・{sourceLabel(it.source)}）
                {it.note ? ` ${it.note}` : ''}
                {it.stores && (
                  <span className="ml-1 rounded bg-surface2 px-1 text-[10px]">
                    {Object.keys(it.stores).length}店舗のみ
                  </span>
                )}
              </p>
              {videoChip(it.video)}
              {it.helpImage && (
                <button
                  type="button"
                  onClick={() => setLightboxUrl(it.helpImage ?? null)}
                  className="h-9 w-9 shrink-0 overflow-hidden rounded border border-border"
                  title="参考画像"
                >
                  <img src={it.helpImage} alt="参考画像" className="h-full w-full object-cover" />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-text-muted">{id}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-text-muted disabled:opacity-50"
          >
            編集
          </button>
          {schedule.archived ? (
            <button
              type="button"
              onClick={() => handleArchive(false)}
              disabled={busy}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-text-muted disabled:opacity-50"
            >
              再表示する
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleArchive(true)}
              disabled={busy}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-text-muted disabled:opacity-50"
            >
              非表示にする
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy || loading || locked}
            title={locked ? '提出がある場合は削除できません' : undefined}
            className="rounded-md bg-ng-bg px-3 py-1.5 text-[11px] font-bold text-ng disabled:opacity-50"
          >
            削除
          </button>
        </div>
        {locked && (
          <p className="mt-2 text-[11px] text-text-muted">
            提出した店舗があるため削除はできません（「非表示にする」で店舗の画面から消せます）。項目・枚数・撮影方法の変更もできません。
          </p>
        )}
      </div>

      <ScheduleStatsSummary
        title={schedule.title}
        stats={stats}
        storeName={(k) => stores[k]?.name ?? k}
        todayKey={todayKey}
        loading={loading}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold">
          提出 {loading ? '…' : doneCount}/{targetKeys.length}店舗
        </span>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border text-[11px] font-bold">
            {(['stores', 'items'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 ${mode === m ? 'bg-accent text-white' : 'text-text-muted'} ${m === 'stores' ? 'rounded-l-md' : 'rounded-r-md'}`}
              >
                {m === 'stores' ? '店舗別' : '項目別'}
              </button>
            ))}
          </div>
          <button type="button" onClick={reload} className="text-[11px] font-bold text-text-muted hover:text-accent">
            ↻ 更新
          </button>
        </div>
      </div>

      {mode === 'items' ? (
        loading ? (
          <p className="py-8 text-center text-sm text-text-muted">集計中…</p>
        ) : (
          <ScheduleItemStats title={schedule.title} stats={stats} data={data} stores={stores} />
        )
      ) : (
        <>
          {!loading && missing.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="select-all whitespace-pre-wrap text-xs">{copyText}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-2 rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-text-muted"
          >
            {copied ? 'コピーしました' : '未提出店舗をコピー'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const photos = photosMap(r.sub?.photos);
            const meta = r.sub?.photoMeta ?? {};
            // 保存ファイル名: 店舗名_スケジュール名-項目名_日付_番号。日付は提出時刻の業務日、無ければ今日
            const nameFor = (it: ScheduleItem, n: number, index: number) => (ext: string) =>
              buildPhotoFileName({
                storeName: r.name,
                label: `${schedule.title}-${it.label}`,
                dateLabel: (meta[String(n)]?.uploadedAt
                  ? getDateKey(0, new Date(meta[String(n)].uploadedAt))
                  : todayKey
                ).replace(/-/g, ''),
                index,
                ext,
              });
            const zipEntries: ZipEntry[] = [];
            itemsForStore(items, r.key).forEach(({ item: it, index: i }) => {
              let index = 0;
              for (let n = ranges[i].start; n < ranges[i].end; n += 1) {
                const u = photos.get(n);
                if (!u) continue;
                index += 1;
                zipEntries.push({ url: u, nameWithExt: nameFor(it, n, index) });
              }
            });
            const chip =
              r.p.status === 'done'
                ? { cls: 'bg-ok-bg text-ok', label: '提出済み' }
                : r.p.status === 'partial'
                  ? { cls: 'bg-warn-bg text-warn', label: `一部提出 ${r.p.doneItems}/${r.p.totalItems}` }
                  : { cls: 'bg-ng-bg text-ng', label: '未提出' };
            return (
              <li key={r.key} className="rounded-xl border border-border bg-surface px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{r.name}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>
                    {chip.label}
                  </span>
                </div>
                {r.sub && (
                  <p className="mt-0.5 text-[10px] text-text-muted">
                    提出: {formatDateTimeJa(r.sub.submittedAt)}
                  </p>
                )}
                {zipEntries.length > 0 && (
                  <div className="mt-1.5">
                    <ZipSaveButton
                      entries={zipEntries}
                      zipName={`${sanitizeFileName(r.name)}_${sanitizeFileName(schedule.title)}_${todayKey.replace(/-/g, '')}.zip`}
                      label={`この店舗の写真をまとめて保存（zip・${zipEntries.length}枚）`}
                    />
                  </div>
                )}
                {photos.size > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {itemsForStore(items, r.key).map(({ item: it, index: i }) => {
                      const range = ranges[i];
                      const urls: Array<{ u: string; n: number }> = [];
                      for (let n = range.start; n < range.end; n += 1) {
                        const u = photos.get(n);
                        if (u) urls.push({ u, n });
                      }
                      if (urls.length === 0) return null;
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="w-20 shrink-0 truncate text-[10px] text-text-muted">
                            {i + 1}. {it.label}
                          </span>
                          <div className="no-scrollbar flex gap-1 overflow-x-auto">
                            {urls.map(({ u, n }, j) => (
                              <div key={j} className="flex shrink-0 flex-col items-center gap-0.5">
                                {it.source === 'video' ? (
                                  <video
                                    src={u}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="h-20 w-28 rounded-md border border-border bg-black"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setLightboxUrl(u)}
                                    className="h-12 w-12 overflow-hidden rounded-md border border-border"
                                  >
                                    <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                                  </button>
                                )}
                                <SavePhotoButton url={u} nameWithExt={nameFor(it, n, j + 1)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
        </>
      )}
      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <VideoModal video={playing} onClose={() => setPlaying(null)} />
    </div>
  );
};

// ============================================================
// 編集（提出の有無を確認してから、フォームを開く）
// ============================================================

const ScheduleEditLoader: FC<{
  id: string;
  schedule: Schedule;
  stores: Record<StoreKey, Store>;
  onCancel: () => void;
  onSaved: () => void;
}> = ({ id, schedule, stores, onCancel, onSaved }) => {
  const { data, loading } = useScheduleSubmissions(id, schedule, stores);
  if (loading) {
    return <p className="py-8 text-center text-sm text-text-muted">提出状況を確認中…</p>;
  }
  return (
    <ScheduleForm
      stores={stores}
      initial={{ id, schedule }}
      locked={hasAnySubmission(data)}
      onCancel={onCancel}
      onSaved={() => onSaved()}
    />
  );
};

// ============================================================
// 参考動画の設定欄
// ============================================================

/** フォーム上の参考動画の状態 */
interface VideoDraft {
  mode: 'none' | 'url' | 'upload';
  /** 貼り付けたURL（判定前の生の文字列） */
  urlInput: string;
  title: string;
  /** 確定している動画（url: 判定OK / upload: アップロード完了 or 既存） */
  value: ScheduleVideo | null;
  /** 新規作成のとき: 保存時にアップロードするファイル（id が決まってから送る） */
  pendingFile: File | null;
}

const draftFromVideo = (v: ScheduleVideo | undefined): VideoDraft => ({
  mode: v ? (v.type === 'upload' ? 'upload' : 'url') : 'none',
  urlInput: v && v.type !== 'upload' ? v.url : '',
  title: v?.title ?? '',
  value: v ?? null,
  pendingFile: null,
});

/** 保存する値（title を反映。mode none なら undefined） */
const videoFromDraft = (d: VideoDraft): ScheduleVideo | undefined => {
  if (d.mode === 'none' || !d.value) return undefined;
  const out: ScheduleVideo = { ...d.value };
  const title = d.title.trim();
  if (title) out.title = title;
  else delete out.title;
  return out;
};

const VideoField: FC<{
  label: string;
  draft: VideoDraft;
  /** 編集時のスケジュールid。新規作成時は null（アップロードは保存時に行う） */
  scheduleId: string | null;
  disabled: boolean;
  onChange: (next: VideoDraft) => void;
  /** 差し替え・削除で不要になった upload の Storage パス（保存時に削除する） */
  onObsoletePath: (path: string) => void;
  /** この編集中にアップロードしたパス（キャンセル時に消すため） */
  onSessionUpload: (path: string) => void;
  onUploadingChange: (uploading: boolean) => void;
}> = ({ label, draft, scheduleId, disabled, onChange, onObsoletePath, onSessionUpload, onUploadingChange }) => {
  const [pct, setPct] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const inputId = useMemo(() => `video-${Math.random().toString(36).slice(2, 8)}`, []);

  const parsed = draft.mode === 'url' && draft.urlInput.trim() ? parseVideoUrl(draft.urlInput) : null;

  const dropCurrentUpload = () => {
    if (draft.value?.type === 'upload' && draft.value.path) onObsoletePath(draft.value.path);
  };

  const setMode = (mode: VideoDraft['mode']) => {
    setMessage(null);
    if (mode === draft.mode) return;
    if (mode === 'none') {
      dropCurrentUpload();
      onChange({ ...draft, mode, value: null, pendingFile: null });
      return;
    }
    if (mode === 'url') {
      dropCurrentUpload();
      onChange({ ...draft, mode, value: null, pendingFile: null, urlInput: '' });
      return;
    }
    // upload へ切り替え: URL の設定は捨てる
    onChange({ ...draft, mode, value: null, pendingFile: null, urlInput: '' });
  };

  const onUrlChange = (text: string) => {
    const p = parseVideoUrl(text);
    onChange({
      ...draft,
      urlInput: text,
      value: p ? { type: p.type, url: p.url } : null,
    });
  };

  const onPickFile = async (file: File) => {
    setMessage(null);
    if (!file.type.startsWith('video/')) {
      setMessage('動画ファイルを選んでください');
      return;
    }
    if (file.size >= SCHEDULE_VIDEO_MAX_BYTES) {
      setMessage(`ファイルが大きすぎます（${formatMB(file.size)}）。100MB未満にするか、YouTubeの限定公開URLを使ってください`);
      return;
    }
    if (file.size > SCHEDULE_VIDEO_WARN_BYTES) {
      setMessage(`${formatMB(file.size)} あります。店舗の通信量が大きくなります。YouTubeの限定公開URLがおすすめです`);
    }
    // 古いアップロード分は保存時に消す
    dropCurrentUpload();
    if (!scheduleId) {
      // 新規作成: 保存時にアップロード
      onChange({ ...draft, value: null, pendingFile: file });
      return;
    }
    onUploadingChange(true);
    setPct(0);
    try {
      const up = await uploadScheduleMedia(scheduleId, file, (loaded, total) =>
        setPct(total > 0 ? Math.floor((loaded / total) * 100) : 0),
      );
      onSessionUpload(up.path);
      onChange({ ...draft, value: { type: 'upload', url: up.url, path: up.path, size: up.size }, pendingFile: null });
    } catch (err) {
      setMessage('アップロードに失敗しました: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setPct(null);
      onUploadingChange(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm';
  const current = draft.value;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface2/60 p-2.5">
      <p className="text-[11px] font-bold text-text-muted">{label}（任意）</p>
      <div className="flex gap-1.5">
        {(
          [
            ['none', 'なし'],
            ['url', 'URLを貼る（YouTube・Vimeo）'],
            ['upload', 'ファイルをアップロード'],
          ] as const
        ).map(([mode, text]) => (
          <button
            key={mode}
            type="button"
            disabled={disabled}
            onClick={() => setMode(mode)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold ${
              draft.mode === mode ? 'bg-accent text-white' : 'border border-border bg-surface text-text-muted'
            } disabled:opacity-50`}
          >
            {text}
          </button>
        ))}
      </div>

      {draft.mode === 'url' && (
        <div className="space-y-1">
          <input
            type="url"
            value={draft.urlInput}
            disabled={disabled}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://youtu.be/… または https://vimeo.com/…"
            className={inputCls}
          />
          {draft.urlInput.trim() &&
            (parsed ? (
              <p className="text-[11px] font-bold text-ok">OK：{VIDEO_TYPE_LABEL[parsed.type]} の動画として保存します</p>
            ) : (
              <p className="text-[11px] font-bold text-ng">
                対応していないURLです（youtube.com/watch?v=、youtu.be/、youtube.com/shorts/、vimeo.com/数字 に対応）
              </p>
            ))}
        </div>
      )}

      {draft.mode === 'upload' && (
        <div className="space-y-1">
          <label
            htmlFor={inputId}
            className={`inline-block cursor-pointer rounded border border-border bg-surface px-2 py-1 text-[11px] font-bold text-text-muted ${disabled ? 'opacity-50' : ''}`}
          >
            {current?.type === 'upload' || draft.pendingFile ? '別のファイルにする' : '動画ファイルを選ぶ'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="video/*"
            disabled={disabled || pct !== null}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
              e.target.value = '';
            }}
          />
          <p className="text-[10px] text-text-muted">
            mp4 を推奨します（iPhone の .mov は Android で再生できない場合があります）。100MB未満。
          </p>
          {draft.pendingFile && (
            <p className="text-[11px] text-text-muted">
              選択中: {draft.pendingFile.name}（{formatMB(draft.pendingFile.size)}）。保存時にアップロードします
            </p>
          )}
          {pct !== null && (
            <div>
              <div className="flex justify-between text-[10px] font-bold text-text-muted">
                <span>アップロード中…</span>
                <span>{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2">
                <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {current?.type === 'upload' && (
            <p className="text-[11px] text-ok">
              アップロード済み{typeof current.size === 'number' ? `（${formatMB(current.size)}）` : ''}
            </p>
          )}
        </div>
      )}

      {draft.mode !== 'none' && (
        <input
          type="text"
          value={draft.title}
          disabled={disabled}
          maxLength={SCHEDULE_VIDEO_TITLE_MAX}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          placeholder="動画の表示名（任意、40字まで）"
          className={inputCls}
        />
      )}

      {message && <p className="text-[11px] font-bold text-warn">{message}</p>}

      {current && (
        <div>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="text-[11px] font-bold text-accent"
          >
            {preview ? 'プレビューを閉じる' : 'プレビュー再生'}
          </button>
          {preview && (
            <div className="mt-1 overflow-hidden rounded-lg bg-black" style={{ aspectRatio: '16 / 9' }}>
              {current.type === 'upload' ? (
                <video src={current.url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
              ) : (
                <iframe
                  src={current.url}
                  title="プレビュー"
                  className="h-full w-full"
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 店舗の選択（全店／選択＋検索つきチェック）
// ============================================================

const StoreSelector: FC<{
  stores: Record<StoreKey, Store>;
  storeKeys: StoreKey[];
  all: boolean;
  selected: Set<StoreKey>;
  allLabel: string;
  onAllChange: (all: boolean) => void;
  onToggle: (key: StoreKey) => void;
  compact?: boolean;
}> = ({ stores, storeKeys, all, selected, allLabel, onAllChange, onToggle, compact }) => {
  const [search, setSearch] = useState('');
  const filtered = storeKeys.filter(
    (k) => !search || stores[k].name.toLowerCase().includes(search.toLowerCase()),
  );
  const btn = compact ? 'py-1.5 text-[11px]' : 'py-2 text-xs';
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAllChange(true)}
          className={`flex-1 rounded-lg font-bold ${btn} ${all ? 'bg-accent text-white' : 'border border-border bg-surface text-text-muted'}`}
        >
          {allLabel}
        </button>
        <button
          type="button"
          onClick={() => onAllChange(false)}
          className={`flex-1 rounded-lg font-bold ${btn} ${!all ? 'bg-accent text-white' : 'border border-border bg-surface text-text-muted'}`}
        >
          選択（{selected.size}店舗）
        </button>
      </div>
      {!all && (
        <div className="space-y-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="店舗名で検索"
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <div className={`${compact ? 'max-h-40' : 'max-h-56'} space-y-1 overflow-y-auto rounded-lg border border-border bg-bg p-2`}>
            {filtered.map((k) => (
              <label key={k} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={selected.has(k)} onChange={() => onToggle(k)} />
                <span className="truncate">{stores[k].name}</span>
              </label>
            ))}
            {filtered.length === 0 && <p className="text-[11px] text-text-muted">該当する店舗がありません</p>}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// 新規作成・編集フォーム
// ============================================================

interface DraftItem {
  label: string;
  required: string;
  max: string;
  source: 'camera' | 'library' | 'video';
  note: string;
  /** 保存済みの参考画像URL（'' = なし） */
  helpImage: string;
  /** 保存時にアップロードする新しい参考画像（null = 変更なし） */
  helpImageFile: File | null;
  video: VideoDraft;
  /** この項目を表示する店舗。null = 対象店舗すべて */
  stores: Set<StoreKey> | null;
}

const emptyItem = (): DraftItem => ({
  label: '',
  required: '1',
  max: '1',
  source: 'camera',
  note: '',
  helpImage: '',
  helpImageFile: null,
  video: draftFromVideo(undefined),
  stores: null,
});

const toDraftItems = (items: ScheduleItem[]): DraftItem[] =>
  items.map((it) => ({
    label: it.label,
    required: String(it.required),
    max: String(it.max),
    source: it.source,
    note: it.note ?? '',
    helpImage: it.helpImage ?? '',
    helpImageFile: null,
    video: draftFromVideo(it.video),
    stores: it.stores ? new Set(Object.keys(it.stores)) : null,
  }));

const storesRecord = (keys: Set<StoreKey> | null): Record<StoreKey, true> | undefined => {
  if (!keys) return undefined;
  const out: Record<StoreKey, true> = {};
  keys.forEach((k) => {
    out[k] = true;
  });
  return out;
};

const fromDraftItems = (items: DraftItem[]): ScheduleItem[] =>
  items.map((it) => {
    const video = videoFromDraft(it.video);
    const stores = storesRecord(it.stores);
    return {
      label: it.label,
      required: Number(it.required),
      max: Number(it.max),
      source: it.source,
      ...(it.note.trim() ? { note: it.note.trim() } : {}),
      ...(it.helpImage ? { helpImage: it.helpImage } : {}),
      ...(video ? { video } : {}),
      ...(stores ? { stores } : {}),
    };
  });

/** 参考画像の選択ボタン（選ぶとプレビュー表示。保存時にアップロード） */
const HelpImagePicker: FC<{
  item: DraftItem;
  disabled: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}> = ({ item, disabled, onPick, onClear }) => {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!item.helpImageFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(item.helpImageFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [item.helpImageFile]);
  const shown = preview ?? (item.helpImage || null);
  const inputId = useMemo(() => `help-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <div className="flex items-center gap-2">
      {shown ? (
        <img src={shown} alt="参考画像" className="h-12 w-12 rounded border border-border object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-border text-[10px] text-text-muted">
          なし
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label
          htmlFor={inputId}
          className={`cursor-pointer rounded border border-border bg-surface px-2 py-1 text-[11px] font-bold text-text-muted ${disabled ? 'opacity-50' : ''}`}
        >
          参考画像を{shown ? '変更' : '選ぶ'}（任意）
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
        />
        {shown && (
          <button type="button" onClick={onClear} disabled={disabled} className="text-left text-[11px] font-bold text-ng disabled:opacity-50">
            参考画像を外す
          </button>
        )}
      </div>
    </div>
  );
};

const ScheduleForm: FC<{
  stores: Record<StoreKey, Store>;
  initial: { id: string; schedule: Schedule } | null;
  /** true = 提出があるため項目・枚数・撮影方法は変更不可 */
  locked: boolean;
  onCancel: () => void;
  onSaved: (id: string) => void;
}> = ({ stores, initial, locked, onCancel, onSaved }) => {
  const s = initial?.schedule ?? null;
  const originalItems = useMemo(() => scheduleItems(s), [s]);
  // 提出がある（locked）場合でも、末尾への項目追加は番号がずれないので許可する。
  // 既存の項目（index < originalCount）は枚数・撮影方法・順番・削除を固定する。
  const originalCount = locked ? originalItems.length : 0;
  const [title, setTitle] = useState(s?.title ?? '');
  const [description, setDescription] = useState(s?.description ?? '');
  const [from, setFrom] = useState(s?.from ?? '');
  const [to, setTo] = useState(s?.to ?? '');
  const [allStores, setAllStores] = useState(!s?.stores);
  const [selected, setSelected] = useState<Set<StoreKey>>(
    () => new Set(s?.stores ? Object.keys(s.stores) : []),
  );
  const [items, setItems] = useState<DraftItem[]>(() =>
    originalItems.length > 0 ? toDraftItems(originalItems) : [emptyItem()],
  );
  const [scheduleVideo, setScheduleVideo] = useState<VideoDraft>(() => draftFromVideo(s?.video));
  const [obsoletePaths, setObsoletePaths] = useState<string[]>([]);
  /** この編集中にアップロードしたパス。保存で使われなかった分・キャンセル時は消す */
  const [sessionUploads, setSessionUploads] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const storeKeys = useMemo(() => sortedStoreKeys(stores), [stores]);
  /** 項目ごとの店舗選択の候補（スケジュールの対象店舗に絞る） */
  const targetKeysForItems = allStores ? storeKeys : storeKeys.filter((k) => selected.has(k));

  const parsedItems = fromDraftItems(items);
  const currentTotal = totalMax(
    parsedItems.map((it) => ({ ...it, max: Number.isFinite(it.max) && it.max >= 1 ? it.max : 1 })),
  );

  const updateItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const moveItem = (idx: number, delta: number) =>
    setItems((prev) => {
      const j = idx + delta;
      if (j < originalCount || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  const removeItem = (idx: number) =>
    setItems((prev) => {
      if (idx < originalCount) return prev;
      const target = prev[idx];
      if (target?.video.value?.type === 'upload' && target.video.value.path) {
        const p = target.video.value.path;
        setObsoletePaths((paths) => [...paths, p]);
      }
      return prev.filter((_, i) => i !== idx);
    });

  const toggleStore = (k: StoreKey) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const addObsolete = (path: string) => setObsoletePaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
  const addSessionUpload = (path: string) => setSessionUploads((prev) => (prev.includes(path) ? prev : [...prev, path]));
  const onUploadingChange = (uploading: boolean) =>
    setUploadingCount((n) => Math.max(0, n + (uploading ? 1 : -1)));

  const uploading = uploadingCount > 0;

  /** キャンセル: この編集中にアップロードした動画は保存されないので消す */
  const handleCancel = async () => {
    if (sessionUploads.length > 0) {
      await Promise.all(sessionUploads.map((p) => deleteScheduleMediaObject(p)));
    }
    onCancel();
  };

  const handleSave = async () => {
    setMessage(null);
    // 構造が固定されていても、項目名・注意書き・参考画像・参考動画は変更できる（番号は変わらない）。
    // 末尾に追加した項目（index >= originalCount）はそのまま使う。
    const baseItems: ScheduleItem[] = locked
      ? [
          ...originalItems.map((it, i) => {
            const d = items[i];
            const merged: ScheduleItem = { ...it, label: d?.label ?? it.label };
            const note = d?.note?.trim() ?? '';
            if (note) merged.note = note;
            else delete merged.note;
            if (d?.helpImage) merged.helpImage = d.helpImage;
            else delete merged.helpImage;
            const video = d ? videoFromDraft(d.video) : undefined;
            if (video) merged.video = video;
            else delete merged.video;
            // 表示する店舗の変更は番号に影響しないので、提出があっても変更できる
            const itemStores = d ? storesRecord(d.stores) : undefined;
            if (itemStores) merged.stores = itemStores;
            else delete merged.stores;
            return merged;
          }),
          ...parsedItems.slice(originalCount),
        ]
      : parsedItems;
    // URL モードで判定できていない・upload モードでファイル未選択のものを弾く
    const videoDrafts: Array<[string, VideoDraft]> = [
      ['スケジュール全体', scheduleVideo],
      ...items.map((it, i) => [`${i + 1}番目の項目`, it.video] as [string, VideoDraft]),
    ];
    for (const [where, d] of videoDrafts) {
      if (d.mode === 'url' && !d.value) {
        setMessage(`${where}の参考動画のURLが対応していない形式です`);
        return;
      }
      if (d.mode === 'upload' && !d.value && !d.pendingFile) {
        setMessage(`${where}の参考動画のファイルを選ぶか、「なし」にしてください`);
        return;
      }
    }
    const input: ScheduleInput = {
      title,
      description,
      from,
      to,
      stores: allStores ? null : Array.from(selected),
      items: baseItems,
      video: videoFromDraft(scheduleVideo),
    };
    const err = validateScheduleInput(input);
    if (err) {
      setMessage(err);
      return;
    }
    // 項目ごとの店舗は、スケジュールの対象店舗の中から選ぶ
    for (let i = 0; i < items.length; i += 1) {
      const sel = items[i].stores;
      if (!sel) continue;
      if (sel.size === 0) {
        setMessage(`${i + 1}番目の項目の店舗を1つ以上選ぶか、「対象店舗すべて」にしてください`);
        return;
      }
      if (!allStores && Array.from(sel).some((k) => !selected.has(k))) {
        setMessage(`${i + 1}番目の項目に、スケジュールの対象外の店舗が含まれています`);
        return;
      }
    }
    if (initial && locked && !sameStructure(input.items.slice(0, originalCount), originalItems)) {
      setMessage('提出がある項目の枚数・撮影方法は変更できません');
      return;
    }
    setBusy(true);
    try {
      const id = initial ? initial.id : newScheduleId(input.from);
      // 新規作成で選んだ参考動画（保存時アップロード）
      let scheduleVideoFinal = input.video;
      if (scheduleVideo.mode === 'upload' && scheduleVideo.pendingFile) {
        setMessage('参考動画をアップロード中…（スケジュール全体）');
        const up = await uploadScheduleMedia(id, scheduleVideo.pendingFile, (l, t) =>
          setMessage(`参考動画をアップロード中…（スケジュール全体 ${t > 0 ? Math.floor((l / t) * 100) : 0}%）`),
        );
        scheduleVideoFinal = { type: 'upload', url: up.url, path: up.path, size: up.size };
        const t = scheduleVideo.title.trim();
        if (t) scheduleVideoFinal.title = t;
      }
      // 新しく選んだ参考画像・参考動画を先にアップロードして差し込む
      const withMedia: ScheduleItem[] = [];
      for (let i = 0; i < input.items.length; i += 1) {
        const it = { ...input.items[i] };
        const d = items[i];
        const file = d?.helpImageFile ?? null;
        if (file) {
          setMessage(`参考画像をアップロード中…（項目 ${i + 1}）`);
          it.helpImage = await uploadScheduleRefImage(id, i, file);
        }
        if (d?.video.mode === 'upload' && d.video.pendingFile) {
          setMessage(`参考動画をアップロード中…（項目 ${i + 1}）`);
          const up = await uploadScheduleMedia(id, d.video.pendingFile, (l, t) =>
            setMessage(`参考動画をアップロード中…（項目 ${i + 1} ${t > 0 ? Math.floor((l / t) * 100) : 0}%）`),
          );
          const v: ScheduleVideo = { type: 'upload', url: up.url, path: up.path, size: up.size };
          const t = d.video.title.trim();
          if (t) v.title = t;
          it.video = v;
        }
        withMedia.push(it);
      }
      setMessage(null);
      const finalInput: ScheduleInput = { ...input, items: withMedia, video: scheduleVideoFinal };
      if (initial) {
        await updateSchedule(initial.id, finalInput);
      } else {
        await createSchedule(id, finalInput);
      }
      // 差し替え・削除で不要になった動画ファイルと、この編集中にアップロードしたが保存に使われなかった
      // ファイルを消す（失敗しても保存は完了している）
      const usedPaths = new Set<string>();
      if (finalInput.video?.path) usedPaths.add(finalInput.video.path);
      finalInput.items.forEach((it) => {
        if (it.video?.path) usedPaths.add(it.video.path);
      });
      const toDelete = new Set<string>([
        ...obsoletePaths.filter((p) => !usedPaths.has(p)),
        ...sessionUploads.filter((p) => !usedPaths.has(p)),
      ]);
      await Promise.all(Array.from(toDelete).map((p) => deleteScheduleMediaObject(p)));
      onSaved(id);
    } catch (err) {
      setMessage('保存に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm';
  const editingId = initial?.id ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void handleCancel()} className="text-lg text-text-muted hover:text-accent" aria-label="戻る">
          ←
        </button>
        <h2 className="text-sm font-bold">{initial ? 'スケジュールを編集' : 'スケジュールを新規作成'}</h2>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
        <label className="block text-xs font-bold">
          タイトル
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: POP張り替え" maxLength={60} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="block text-xs font-bold">
          説明（任意）
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={200} placeholder="店舗に伝えたいこと" className={`mt-1 ${inputCls}`} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-bold">
            開始日
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-xs font-bold">
            終了日
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
        <p className="text-[11px] text-text-muted">期間は業務日（朝9時切替）で、開始日と終了日の両方を含みます。撮影方法「動画」は1枠に動画1本（撮影またはフォルダから選択。500MBまで、スマホの標準画質で5〜8分程度）です。</p>
        <VideoField
          label="スケジュール全体の参考動画"
          draft={scheduleVideo}
          scheduleId={editingId}
          disabled={busy}
          onChange={setScheduleVideo}
          onObsoletePath={addObsolete}
          onSessionUpload={addSessionUpload}
          onUploadingChange={onUploadingChange}
        />
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-surface p-3">
        <p className="text-xs font-bold">対象店舗</p>
        <StoreSelector
          stores={stores}
          storeKeys={storeKeys}
          all={allStores}
          selected={selected}
          allLabel="全店"
          onAllChange={setAllStores}
          onToggle={toggleStore}
        />
        <p className="text-[11px] text-text-muted">項目ごとに表示する店舗を絞りたいときは、各項目の「この項目を表示する店舗」で選べます。</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold">項目</p>
          <span className={`text-[11px] font-bold ${currentTotal > SCHEDULE_MAX_PHOTOS ? 'text-ng' : 'text-text-muted'}`}>
            上限の合計 {currentTotal}/{SCHEDULE_MAX_PHOTOS}枚
          </span>
        </div>
        {locked && (
          <p className="rounded-lg bg-warn-bg px-3 py-2 text-[11px] text-warn">
            提出した店舗があるため、既存の項目の削除・並べ替え・枚数・撮影方法は変更できません（写真の番号がずれて対応が壊れるため）。項目名・注意書き・参考画像・参考動画は変更できます。
            新しい項目は末尾に追加できます（追加すると、提出済みの店舗も新しい項目ぶんが「一部提出」になります）。
          </p>
        )}
        {items.map((it, idx) => {
          const fixed = idx < originalCount;
          return (
          <div key={idx} className="space-y-2 rounded-xl border border-border bg-bg p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-muted">
                項目 {idx + 1}
                {fixed && <span className="ml-1 font-normal">（提出あり・固定）</span>}
                {locked && !fixed && <span className="ml-1 font-normal text-accent">（追加分）</span>}
              </span>
              {!fixed && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx <= originalCount} className="rounded border border-border px-2 py-0.5 text-[11px] disabled:opacity-30" aria-label="上へ">↑</button>
                  <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="rounded border border-border px-2 py-0.5 text-[11px] disabled:opacity-30" aria-label="下へ">↓</button>
                  <button type="button" onClick={() => removeItem(idx)} disabled={items.length <= 1} className="rounded bg-ng-bg px-2 py-0.5 text-[11px] font-bold text-ng disabled:opacity-30">削除</button>
                </div>
              )}
            </div>
            <input type="text" value={it.label} onChange={(e) => updateItem(idx, { label: e.target.value })} placeholder="項目名（例: 入口のPOP）" maxLength={40} className={inputCls} />
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[11px] font-bold text-text-muted">
                必要枚数
                <input type="number" min={1} max={20} value={it.required} disabled={fixed} onChange={(e) => updateItem(idx, { required: e.target.value })} className={`mt-1 ${inputCls} disabled:opacity-60`} />
              </label>
              <label className="block text-[11px] font-bold text-text-muted">
                上限枚数
                <input type="number" min={1} max={20} value={it.max} disabled={fixed} onChange={(e) => updateItem(idx, { max: e.target.value })} className={`mt-1 ${inputCls} disabled:opacity-60`} />
              </label>
              <label className="block text-[11px] font-bold text-text-muted">
                撮影方法
                <select value={it.source} disabled={fixed} onChange={(e) => updateItem(idx, { source: e.target.value as 'camera' | 'library' | 'video' })} className={`mt-1 ${inputCls} disabled:opacity-60`}>
                  <option value="camera">撮影のみ</option>
                  <option value="library">写真フォルダも可</option>
                  <option value="video">動画（撮影・フォルダ可）</option>
                </select>
              </label>
            </div>
            <input type="text" value={it.note} onChange={(e) => updateItem(idx, { note: e.target.value })} placeholder="注意書き（任意）" maxLength={200} className={inputCls} />
            <div className="space-y-1 rounded-xl border border-border bg-surface2/60 p-2.5">
              <p className="text-[11px] font-bold text-text-muted">この項目を表示する店舗</p>
              <StoreSelector
                stores={stores}
                storeKeys={targetKeysForItems}
                all={it.stores === null}
                selected={it.stores ?? new Set<StoreKey>()}
                allLabel="対象店舗すべて"
                onAllChange={(all) => updateItem(idx, { stores: all ? null : new Set(it.stores ?? []) })}
                onToggle={(k) =>
                  setItems((prev) =>
                    prev.map((d, i) => {
                      if (i !== idx) return d;
                      const next = new Set(d.stores ?? []);
                      if (next.has(k)) next.delete(k);
                      else next.add(k);
                      return { ...d, stores: next };
                    }),
                  )
                }
                compact
              />
            </div>
            <HelpImagePicker
              item={it}
              disabled={busy}
              onPick={(file) => updateItem(idx, { helpImageFile: file })}
              onClear={() => updateItem(idx, { helpImageFile: null, helpImage: '' })}
            />
            <VideoField
              label="この項目の参考動画"
              draft={it.video}
              scheduleId={editingId}
              disabled={busy}
              onChange={(next) => updateItem(idx, { video: next })}
              onObsoletePath={addObsolete}
              onSessionUpload={addSessionUpload}
              onUploadingChange={onUploadingChange}
            />
          </div>
          );
        })}
        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
          className="w-full rounded-lg border border-dashed border-accent/60 py-2 text-xs font-bold text-accent"
        >
          ＋ 項目を追加{locked ? '（末尾に追加）' : ''}
        </button>
      </div>

      {message && (
        <p className="rounded-lg bg-warn-bg px-3 py-2 text-xs font-bold text-warn">{message}</p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={busy || uploading} className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-50">
          {busy ? '保存中…' : uploading ? '動画のアップロード中…' : initial ? '保存' : '作成'}
        </button>
        <button type="button" onClick={() => void handleCancel()} disabled={busy} className="flex-1 rounded-lg border border-border bg-surface py-2.5 text-sm font-bold text-text-muted">
          キャンセル
        </button>
      </div>
    </div>
  );
};
