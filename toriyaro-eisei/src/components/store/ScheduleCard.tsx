import { useMemo, useState, type FC } from 'react';
import { VideoModal } from '../ui/VideoModal';
import { useSchedules } from '../../hooks/useSchedules';
import { useStoreSubmissionStatus } from '../../hooks/useSubmissions';
import { getDateKey } from '../../lib/dateUtils';
import {
  SCHEDULE_UPCOMING_DAYS,
  formatScheduleRange,
  isStoreTargeted,
  isUpcomingSoon,
  itemsForStore,
  progress,
  scheduleItems,
  scheduleStatus,
} from '../../lib/schedule';
import type { Schedule, ScheduleVideo, StoreKey } from '../../types';

interface SectionProps {
  storeKey: StoreKey;
  onOpen: (scheduleId: string) => void;
}

/**
 * 店舗トップの「年間スケジュール」セクション。
 * 期間中で自店が対象のものをカードで、予定（30日以内）を薄い文字で出す。該当なしなら何も出さない。
 * 未提出カウントや月次集計には一切含めない。
 */
export const ScheduleSection: FC<SectionProps> = ({ storeKey, onOpen }) => {
  const { schedules } = useSchedules();
  const todayKey = getDateKey();
  const limitKey = getDateKey(SCHEDULE_UPCOMING_DAYS);

  const { active, upcoming } = useMemo(() => {
    const activeList: Array<[string, Schedule]> = [];
    const upcomingList: Array<[string, Schedule]> = [];
    Object.entries(schedules).forEach(([id, s]) => {
      if (!isStoreTargeted(s, storeKey)) return;
      if (scheduleStatus(s, todayKey) === 'active') activeList.push([id, s]);
      else if (isUpcomingSoon(s, todayKey, limitKey)) upcomingList.push([id, s]);
    });
    activeList.sort((a, b) => a[1].to.localeCompare(b[1].to) || a[1].from.localeCompare(b[1].from));
    upcomingList.sort((a, b) => a[1].from.localeCompare(b[1].from));
    return { active: activeList, upcoming: upcomingList };
  }, [schedules, storeKey, todayKey, limitKey]);

  if (active.length === 0 && upcoming.length === 0) return null;

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-xs font-bold text-text-muted">年間スケジュール</h2>
      {/* 未提出・一部提出は大きなカード、提出済みは1行にまとめて下に並べる（並び順は各カードの order で決める） */}
      <div className="flex flex-col gap-3">
        {active.map(([id, s]) => (
          <ScheduleCard key={id} scheduleId={id} schedule={s} storeKey={storeKey} onOpen={() => onOpen(id)} />
        ))}
      </div>
      {upcoming.length > 0 && (
        <ul className="mt-2 space-y-1 px-1">
          {upcoming.map(([id, s]) => (
            <li key={id} className="text-[11px] text-text-muted">
              {formatScheduleRange(s.from, s.to).split('〜')[0]}〜 {s.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

interface CardProps {
  scheduleId: string;
  schedule: Schedule;
  storeKey: StoreKey;
  onOpen: () => void;
}

/** 期間中のスケジュール1件のカード。提出状況は submissions/{store}/weekly/{id} から判定 */
export const ScheduleCard: FC<CardProps> = ({ scheduleId, schedule, storeKey, onOpen }) => {
  const { submission, loading } = useStoreSubmissionStatus(storeKey, 'weekly', scheduleId);
  const items = scheduleItems(schedule);
  // この店舗に表示する項目だけで判定する
  const p = progress(items, submission?.photos, storeKey);
  const [playing, setPlaying] = useState<ScheduleVideo | null>(null);
  // カードの再生アイコン: スケジュール全体の動画があればそれ、無ければ（この店舗に表示する）最初の項目の動画
  const cardVideo: ScheduleVideo | null =
    schedule.video ?? itemsForStore(items, storeKey).find(({ item }) => !!item.video)?.item.video ?? null;

  const chip =
    p.status === 'done'
      ? { cls: 'bg-ok-bg text-ok', label: '提出済み' }
      : p.status === 'partial'
        ? { cls: 'bg-warn-bg text-warn', label: `一部提出 ${p.doneItems}/${p.totalItems}項目` }
        : { cls: 'bg-ng-bg text-ng', label: '未提出' };

  // 提出状況が分かるまでは1行ぶんの場所だけ確保する（大きなカードが出てから縮むのを防ぐ）
  if (loading) {
    return (
      <div className="flex min-h-[48px] items-center rounded-2xl border border-border bg-surface px-4 text-sm font-bold text-text-muted shadow-sm">
        <span className="truncate">{schedule.title}</span>
      </div>
    );
  }

  // 提出済み: 1行にまとめる。押すと確認・撮り直しの画面を開く
  if (p.status === 'done') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="order-last flex min-h-[48px] w-full items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2 text-left shadow-sm transition active:scale-[0.99]"
        aria-label={`${schedule.title}（提出済み）の写真を確認・撮り直す`}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{schedule.title}</span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${chip.cls}`}>{chip.label}</span>
        <span className="shrink-0 text-base text-text-muted" aria-hidden="true">›</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-accent bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{schedule.title}</h3>
          <p className="mt-0.5 text-[11px] text-text-muted">
            期間 {formatScheduleRange(schedule.from, schedule.to)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {cardVideo && (
            <button
              type="button"
              onClick={() => setPlaying(cardVideo)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent active:scale-95"
              aria-label="参考動画を見る"
              title="参考動画を見る"
            >
              ▶
            </button>
          )}
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${chip.cls}`}>
            {chip.label}
          </span>
        </div>
      </div>
      {schedule.description && (
        <p className="mt-2 whitespace-pre-wrap text-xs text-text">{schedule.description}</p>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99]"
      >
        {p.status === 'partial' ? '続きを撮影して提出' : '撮影して提出'}
      </button>
      <VideoModal video={playing} onClose={() => setPlaying(null)} />
    </div>
  );
};
