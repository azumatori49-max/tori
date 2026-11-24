import { useEffect, useMemo, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { Lightbox } from '../ui/Lightbox';
import { VideoModal } from '../ui/VideoModal';
import { fetchSubmissionRange, fetchSubmissionsForKey } from '../../hooks/useSubmissions';
import { useSchedules } from '../../hooks/useSchedules';
import {
  getDateKey,
  getMonthKey,
  getWeekKey,
  formatDateKeyJa,
  formatMonthKeyJa,
  isFutureDate,
  isFutureWeek,
  weekKeyToDate,
} from '../../lib/dateUtils';
import { itemsForType, targetForType } from '../../data/checkItems';
import { MISS_TRACK_START } from '../../lib/missTrack';
import {
  formatScheduleRange,
  isStoreTargeted,
  photosMap,
  progress,
  scheduleItems,
  scheduleStatus,
} from '../../lib/schedule';
import type { ReportType, Schedule, ScheduleVideo, StoreKey, Submission } from '../../types';

/** この画面のタブ。'schedule' は年間スケジュール */
type HistoryTab = ReportType | 'schedule';

const TAB_LABEL: Record<HistoryTab, string> = {
  daily: 'デイリー',
  weekly: 'ウィークリー',
  monthly: 'マンスリー',
  schedule: '年間スケジュール',
};

/** マンスリー開始月（この月より前で記録が無い月は「記録なし」扱い） — StoreTopScreen と揃える */
const MONTHLY_START = 'M2026-08';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  /** 店舗の登録日時（ISO文字列）。無い店舗は登録日による除外をしない */
  createdAt?: string;
  onBack: () => void;
}

/**
 * 「未提出」表示の比較に使う日付キー。
 * デイリーはそのまま、ウィークリーはその週の日曜日（月曜+6日）。
 * base を渡すので 9時切替の補正は掛からない。
 */
const compareDateKey = (tab: ReportType, k: string): string => {
  // マンスリーはその月の末日相当（文字列比較用）
  if (tab === 'monthly') return `${k.slice(1)}-31`;
  if (tab !== 'weekly') return k;
  const sun = weekKeyToDate(k);
  sun.setDate(sun.getDate() + 6);
  return getDateKey(0, sun);
};

const sparsePhotos = (raw: unknown): Map<number, string> => {
  const map = new Map<number, string>();
  if (!raw) return map;
  if (Array.isArray(raw)) {
    raw.forEach((v, i) => {
      if (typeof v === 'string' && v.length > 0) map.set(i, v);
    });
    return map;
  }
  if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
      const idx = Number(k);
      if (Number.isInteger(idx) && idx >= 0 && typeof v === 'string' && v.length > 0) {
        map.set(idx, v);
      }
    });
  }
  return map;
};

const weekLabel = (weekKey: string): string => {
  const mon = weekKeyToDate(weekKey);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()} 〜 ${sun.getMonth() + 1}/${sun.getDate()} の週`;
};

export const HistoryScreen: FC<Props> = ({ storeKey, storeName, createdAt, onBack }) => {
  const [activeTab, setActiveTab] = useState<HistoryTab>('daily');
  // 年間スケジュールは下の ScheduleHistory が表示する。こちらの一覧はデイリー/ウィークリー/マンスリー用
  const tab: ReportType = activeTab === 'schedule' ? 'daily' : activeTab;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [data, setData] = useState<Record<string, Submission | null>>({});
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // その月に該当するキー一覧（新しい順）
  const keys = useMemo(() => {
    if (tab === 'monthly') {
      // マンスリーは1年ぶんを新しい順に（先の月は出さない）
      const current = getMonthKey();
      const out: string[] = [];
      for (let m = 12; m >= 1; m -= 1) {
        const key = `M${year}-${String(m).padStart(2, '0')}`;
        if (key <= current) out.push(key);
      }
      return out;
    }
    const lastDay = new Date(year, month + 1, 0).getDate();
    if (tab === 'daily') {
      const out: string[] = [];
      for (let d = lastDay; d >= 1; d -= 1) {
        const key = getDateKey(0, new Date(year, month, d));
        if (!isFutureDate(key)) out.push(key);
      }
      return out;
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (let d = lastDay; d >= 1; d -= 1) {
      const wk = getWeekKey(0, new Date(year, month, d));
      if (seen.has(wk)) continue;
      seen.add(wk);
      if (!isFutureWeek(wk)) out.push(wk);
    }
    return out;
  }, [tab, year, month]);

  useEffect(() => {
    if (activeTab === 'schedule') return;
    let cancelled = false;
    setLoading(true);
    const load =
      tab === 'monthly' && keys.length > 0
        ? // マンスリーは1年ぶんを1回で読む
          fetchSubmissionRange(storeKey, 'monthly', keys[keys.length - 1], keys[0]).then((res) =>
            keys.map((k) => [k, res[k] ?? null] as const),
          )
        : Promise.all(
            keys.map((k) =>
              fetchSubmissionsForKey([storeKey], tab, k).then(
                (res) => [k, res[storeKey] ?? null] as const,
              ),
            ),
          );
    load
      .then((entries) => {
        if (!cancelled) {
          setData(Object.fromEntries(entries));
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
  }, [storeKey, activeTab, year, month, keys.join(',')]);

  // マンスリーは年単位、デイリー/ウィークリーは月単位で送る
  const shiftMonth = (delta: number) => {
    const d = tab === 'monthly' ? new Date(year + delta, month, 1) : new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const canForward =
    tab === 'monthly'
      ? year < now.getFullYear()
      : year < now.getFullYear() ||
        (year === now.getFullYear() && month < now.getMonth());

  // 記録が無く、かつ店舗の登録日より前の日（週）は一覧から除外する。
  // createdAt は UTC 日付で持っており、JST の 9時切替と一致する。
  // 「記録が有るか」は取得後の data でしか分からないので、keys ではなく描画側で絞る。
  const createdDate = createdAt ? createdAt.slice(0, 10) : null;
  const visibleKeys = keys.filter((k) => {
    if (data[k]) return true;
    if (createdDate && compareDateKey(tab, k) < createdDate) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-bg pb-10">
      <AppHeader
        title="過去の提出"
        subtitle={storeName}
        left={
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center text-lg text-text-muted hover:text-accent disabled:opacity-40"
            aria-label="戻る"
          >
            ←
          </button>
        }
      />
      <main className="mx-auto w-full max-w-app px-4 py-4">
        <div className="mb-3 rounded-xl bg-surface2 px-3 py-2 text-xs text-text-muted">
          この画面は確認専用です（編集はできません）。抜けている項目は赤字で表示されます。
        </div>
        {/* タブは4つ。スマホ幅では2×2に並べて、文字が切れないようにする */}
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface p-1 shadow-sm sm:grid-cols-4">
          {(['daily', 'weekly', 'monthly', 'schedule'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                // マンスリーから月単位のタブに戻るとき、今年なら今月に合わせる（先の月を出さない）
                if (t !== 'monthly' && year === now.getFullYear() && month > now.getMonth()) setMonth(now.getMonth());
                setActiveTab(t);
              }}
              aria-pressed={activeTab === t}
              className={`min-h-[44px] rounded-xl px-2 py-2 text-xs font-bold transition ${
                activeTab === t ? 'bg-text text-white shadow-sm' : 'text-text-muted'
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {activeTab === 'schedule' ? (
          <ScheduleHistory storeKey={storeKey} />
        ) : (
          <>
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border"
            aria-label={tab === 'monthly' ? '前の年' : '前の月'}
          >
            ←
          </button>
          <div className="text-sm font-bold">
            {tab === 'monthly' ? `${year}年` : `${year}年${month + 1}月`}
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!canForward}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border disabled:opacity-30"
            aria-label={tab === 'monthly' ? '次の年' : '次の月'}
          >
            →
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>
        ) : visibleKeys.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            {tab === 'monthly' ? 'この年の対象データはありません' : 'この月の対象データはありません'}
          </p>
        ) : (
          <div className="space-y-3">
            {visibleKeys.map((k) => {
              const sub = data[k];
              // 記録が無く集計開始前の日（週）は「未提出」ではなく「記録なし」扱い
              const beforeTrack =
                !sub && (tab === 'monthly' ? k < MONTHLY_START : compareDateKey(tab, k) < MISS_TRACK_START);
              const photos = sparsePhotos(sub?.photos);
              const isLine = !!sub?.viaLine;
              const target = targetForType(tab, storeKey, k);
              const items = itemsForType(tab, storeKey, k);
              const lastItem = items[items.length - 1];
              const hasMulti = !!lastItem?.multi;
              const fixedItems = hasMulti ? items.slice(0, -1) : items;
              const missing = isLine
                ? []
                : fixedItems
                    .map((it, i) => ({ it, i }))
                    .filter(({ i }) => !photos.has(i));
              const done = isLine || photos.size >= target;
              const label =
                tab === 'daily' ? formatDateKeyJa(k) : tab === 'weekly' ? weekLabel(k) : formatMonthKeyJa(k);
              const urls = Array.from(photos.values());
              return (
                <div
                  key={k}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">{label}</h3>
                    {sub ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          done ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                        }`}
                      >
                        {isLine
                          ? '提出済み（LINE）'
                          : done
                            ? '提出済み'
                            : `一部提出 ${photos.size}/${target}`}
                      </span>
                    ) : beforeTrack ? (
                      <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs font-bold text-text-muted">
                        記録なし（集計開始前）
                      </span>
                    ) : (
                      <span className="rounded-full bg-ng-bg px-2 py-0.5 text-xs font-bold text-ng">
                        未提出
                      </span>
                    )}
                  </div>
                  {sub && missing.length > 0 && (
                    <p className="mt-2 text-xs font-bold text-ng">
                      抜けている項目：
                      {missing.map(({ it, i }) => `${i + 1}. ${it.label}`).join('・')}
                    </p>
                  )}
                  {!sub && !beforeTrack && (
                    <p className="mt-2 text-xs text-ng">
                      全{fixedItems.length}項目が未提出です
                    </p>
                  )}
                  {urls.length > 0 && (
                    <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                      {urls.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border"
                        >
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </>
        )}
      </main>
      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
};

// ============================================================
// 年間スケジュールの提出履歴（自店が対象のもの・確認専用）
// ============================================================

const ScheduleHistory: FC<{ storeKey: StoreKey }> = ({ storeKey }) => {
  const { schedules, loading: schedulesLoading } = useSchedules();
  const todayKey = getDateKey();
  const [subs, setSubs] = useState<Record<string, Submission | null> | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState<ScheduleVideo | null>(null);

  // 自店が対象で、すでに始まっているもの（新しい順）
  const list = useMemo(
    () =>
      Object.entries(schedules)
        .filter(([, s]) => isStoreTargeted(s, storeKey) && s.from <= todayKey)
        .sort((a, b) => b[1].from.localeCompare(a[1].from) || b[1].to.localeCompare(a[1].to)),
    [schedules, storeKey, todayKey],
  );
  const idsSig = list.map(([id]) => id).join(',');

  useEffect(() => {
    if (schedulesLoading) return;
    const ids = idsSig ? idsSig.split(',') : [];
    if (ids.length === 0) {
      setSubs({});
      return;
    }
    let cancelled = false;
    setSubs(null);
    // 年間スケジュールの提出は submissions/{店舗}/weekly/{スケジュールID} に入っている
    Promise.all(
      ids.map((id) =>
        fetchSubmissionsForKey([storeKey], 'weekly', id).then((res) => [id, res[storeKey] ?? null] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setSubs(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [storeKey, idsSig, schedulesLoading]);

  if (schedulesLoading || subs === null) {
    return <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>;
  }

  // 本部が非表示にしたものは、提出がある場合だけ出す
  const visible = list.filter(([id, s]) => !s.archived || !!subs[id]);
  if (visible.length === 0) {
    return <p className="py-8 text-center text-sm text-text-muted">年間スケジュールの記録はまだありません</p>;
  }

  return (
    <div className="space-y-3">
      {visible.map(([id, s]) => (
        <ScheduleHistoryCard
          key={id}
          schedule={s}
          submission={subs[id] ?? null}
          storeKey={storeKey}
          todayKey={todayKey}
          onOpenPhoto={setLightboxUrl}
          onOpenVideo={(url) => setPlaying({ type: 'upload', url })}
        />
      ))}
      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      <VideoModal video={playing} onClose={() => setPlaying(null)} />
    </div>
  );
};

const ScheduleHistoryCard: FC<{
  schedule: Schedule;
  submission: Submission | null;
  storeKey: StoreKey;
  todayKey: string;
  onOpenPhoto: (url: string) => void;
  onOpenVideo: (url: string) => void;
}> = ({ schedule, submission, storeKey, todayKey, onOpenPhoto, onOpenVideo }) => {
  const items = scheduleItems(schedule);
  const p = progress(items, submission?.photos, storeKey);
  const photos = photosMap(submission?.photos);
  const status = scheduleStatus(schedule, todayKey);
  const chip =
    p.status === 'done'
      ? { cls: 'bg-ok-bg text-ok', label: '提出済み' }
      : p.status === 'partial'
        ? { cls: 'bg-warn-bg text-warn', label: `一部提出 ${p.doneItems}/${p.totalItems}項目` }
        : { cls: 'bg-ng-bg text-ng', label: '未提出' };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{schedule.title}</h3>
          <p className="mt-0.5 text-xs text-text-muted">
            期間 {formatScheduleRange(schedule.from, schedule.to)}
            {status === 'active' ? '（受付中）' : '（終了）'}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${chip.cls}`}>{chip.label}</span>
      </div>
      <ul className="mt-3 space-y-3">
        {p.items.map(({ item, index, range, count, done }) => {
          const urls: string[] = [];
          for (let n = range.start; n < range.end; n += 1) {
            const url = photos.get(n);
            if (url) urls.push(url);
          }
          const isVideo = item.source === 'video';
          return (
            <li key={index}>
              <p className={`text-xs font-bold ${done ? 'text-text' : 'text-ng'}`}>
                {item.label}
                <span className="ml-2 font-normal">
                  {count === 0 ? '未提出' : `${count}${isVideo ? '本' : '枚'}${done ? '' : `（あと${Math.max(0, item.required - count)}）`}`}
                </span>
              </p>
              {urls.length > 0 && (
                <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto">
                  {urls.map((url, i) =>
                    isVideo ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onOpenVideo(url)}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-surface2 text-xs font-bold text-text"
                        aria-label={`${item.label} の動画を再生`}
                      >
                        ▶ 動画
                      </button>
                    ) : (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onOpenPhoto(url)}
                        className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border"
                        aria-label={`${item.label} の写真を拡大`}
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ),
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
