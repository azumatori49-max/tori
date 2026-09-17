import { useEffect, useMemo, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { StoreDetailModal } from '../admin/StoreDetailModal';
import { StatusChip, statusFromCount, statusLabel } from '../ui/StatusChip';
import { fetchSubmissionsForKey, useSubmissionsBulk } from '../../hooks/useSubmissions';
import {
  dateKeyToDate,
  formatDateKeyJa,
  formatDateKeyShort,
  formatDateTimeJa,
  getDateKey,
  getWeekKey,
  isFutureDate,
  isFutureWeek,
  weekKeyToDate,
} from '../../lib/dateUtils';
import { targetForType } from '../../data/checkItems';
import type { ReportTab, Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
  onBack: () => void;
}

/** 未提出カウントの集計開始日（この日より前は数えない） */
const MISS_TRACK_START = '2026-07-11';

const pad = (n: number) => String(n).padStart(2, '0');

interface MissDay {
  d: string;
  c: number;
  t: number;
}

const normalisePhotos = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return Object.keys(obj)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => obj[k])
      .filter((x): x is string => typeof x === 'string' && x.length > 0);
  }
  return [];
};

export const ViewerScreen: FC<Props> = ({ stores, onBack }) => {
  const [reportTab, setReportTab] = useState<ReportTab>('daily');
  const [dateKey, setDateKey] = useState<string>(() => getDateKey());
  const [weekKey, setWeekKey] = useState<string>(() => getWeekKey());
  const [search, setSearch] = useState('');
  const [openStoreKey, setOpenStoreKey] = useState<StoreKey | null>(null);
  const [missDates, setMissDates] = useState<Record<StoreKey, MissDay[]> | null>(null);
  const [missOpen, setMissOpen] = useState(true);

  const currentKey = reportTab === 'daily' ? dateKey : weekKey;

  const todayKey = getDateKey();
  const [ty, tm, td] = todayKey.split('-').map(Number);

  const sortedKeys = useMemo(
    () =>
      Object.keys(stores).sort((a, b) =>
        stores[a].name.localeCompare(stores[b].name, 'ja'),
      ),
    [stores],
  );

  const { data, loading } = useSubmissionsBulk(sortedKeys, reportTab, currentKey);

  // 今月の未提出日を全店分集計（集計開始日〜昨日・業務日ベース）
  useEffect(() => {
    if (sortedKeys.length === 0) return;
    let cancelled = false;

    const monthStart = `${ty}-${pad(tm)}-01`;
    const from = monthStart > MISS_TRACK_START ? monthStart : MISS_TRACK_START;
    const keys: string[] = [];
    for (let day = 1; day < td; day += 1) {
      const k = `${ty}-${pad(tm)}-${pad(day)}`;
      if (k >= from) keys.push(k);
    }

    if (keys.length === 0) {
      setMissDates({});
      return;
    }

    setMissDates(null);
    Promise.all(keys.map((k) => fetchSubmissionsForKey(sortedKeys, 'daily', k)))
      .then((results) => {
        if (cancelled) return;
                const misses: Record<string, MissDay[]> = {};
        sortedKeys.forEach((k) => {
          misses[k] = [];
        });
        results.forEach((dayMap, idx) => {
          const dayKey = keys[idx];
                   sortedKeys.forEach((k) => {
            const created = stores[k]?.createdAt?.slice(0, 10);
            if (created && dayKey < created) return;
            const sub = dayMap[k];
            const target = targetForType('daily', k);
            const c = normalisePhotos(sub?.photos).length;
            const submitted = !!sub?.viaLine || c >= target;
            if (!submitted) misses[k].push({ d: dayKey, c, t: target });
          });
        });
        setMissDates(misses);
      })
      .catch(() => {
        if (!cancelled) setMissDates({});
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedKeys.join(','), ty, tm, td]);

  const missList = useMemo(() => {
    if (!missDates) return [];
    return sortedKeys
      .filter((k) => (missDates[k]?.length ?? 0) > 0)
      .sort((a, b) => (missDates[b]?.length ?? 0) - (missDates[a]?.length ?? 0));
  }, [missDates, sortedKeys]);

  const shiftDate = (delta: number) => {
    if (reportTab === 'daily') {
      const d = dateKeyToDate(dateKey);
      d.setDate(d.getDate() + delta);
      const next = getDateKey(0, d);
      if (delta > 0 && isFutureDate(next)) return;
      setDateKey(next);
    } else {
      const d = weekKeyToDate(weekKey);
      d.setDate(d.getDate() + delta * 7);
      const next = getWeekKey(0, d);
      if (delta > 0 && isFutureWeek(next)) return;
      setWeekKey(next);
    }
  };

  const canForward =
    reportTab === 'daily' ? dateKey < getDateKey() : weekKey < getWeekKey();

  const dateLabel =
    reportTab === 'daily' ? formatDateKeyJa(dateKey) : `週: ${weekKey.slice(1)}`;

  const anchorDateKey =
    reportTab === 'daily' ? dateKey : getDateKey(0, weekKeyToDate(weekKey));

  const filteredKeys = sortedKeys.filter(
    (k) => !search || stores[k].name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-bg pb-10">
      <AppHeader
        title="閲覧モード"
        subtitle="見るだけ・編集不可"
        showLogo
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
      <main className="mx-auto w-full max-w-app space-y-4 px-4 py-4">
        <div className="rounded-xl bg-warn-bg px-3 py-2 text-[11px] font-bold text-warn">
          2026年7月11日から、未提出回数の記録を開始しました。未提出は月ごとに蓄積されます。
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setMissOpen((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <h2 className="text-xs font-bold">
              {tm}月の未提出回数
              <span className="ml-1 font-normal text-text-muted">
                （デイリー・当日分は含みません）
              </span>
            </h2>
            <span className="text-text-muted">{missOpen ? '▲' : '▼'}</span>
          </button>
          {missOpen && (
            <div className="mt-3">
              {missDates === null ? (
                <p className="text-xs text-text-muted">集計中…</p>
              ) : missList.length === 0 ? (
                <p className="text-xs font-bold text-ok">
                  今月の未提出はありません
                </p>
              ) : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                  {missList.map((k) => {
                    const dates = missDates?.[k] ?? [];
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setOpenStoreKey(k)}
                        className="w-full rounded-lg bg-surface2 px-3 py-2 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs font-bold">
                            {stores[k].name}
                          </span>
                          <span className="ml-2 shrink-0 rounded-full bg-ng-bg px-2 py-0.5 text-[10px] font-bold text-ng">
                            未提出：{dates.length}
                          </span>
                        </div>
                          <p className="mt-1 text-[10px] text-text-muted">
                          {dates.map((m) => formatDateKeyShort(m.d) + (m.c > 0 ? `（${m.c}/${m.t}枚）` : '')).join('・')}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex rounded-2xl border border-border bg-surface p-1 shadow-sm">
          {(['daily', 'weekly'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setReportTab(t)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                reportTab === t ? 'bg-accent text-white shadow-sm' : 'text-text-muted'
              }`}
            >
              {t === 'daily' ? 'デイリー' : 'ウィークリー'}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border"
            aria-label="前へ"
          >
            ←
          </button>
          <div className="text-sm font-bold">{dateLabel}</div>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            disabled={!canForward}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border disabled:opacity-30"
            aria-label="次へ"
          >
            →
          </button>
        </div>

        <input
          type="search"
          placeholder="店舗名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
        />

        {loading ? (
          <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>
        ) : (
          <div className="space-y-2">
            {filteredKeys.map((k) => {
              const sub = data[k] ?? null;
              const photos = normalisePhotos(sub?.photos);
              const target = targetForType(reportTab, k);
              const isLine = !!sub?.viaLine;
              const status = isLine ? 'ok' : statusFromCount(photos.length, target);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOpenStoreKey(k)}
                  className="block w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-bold">{stores[k].name}</h3>
                    <StatusChip kind={status}>
                      {isLine ? '提出済み（LINE）' : statusLabel(status)}
                    </StatusChip>
                  </div>
                  {photos.length > 0 && (
                    <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                      {photos.map((url, i) => (
                        <div
                          key={i}
                          className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border"
                        >
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {sub ? (
                    <p className="mt-2 text-[11px] text-text-muted">
                      提出: {formatDateTimeJa(sub.submittedAt)}
                      {!isLine && ` ・ ${photos.length}枚`}
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-ng">未提出</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      <StoreDetailModal
        open={!!openStoreKey}
        storeKey={openStoreKey}
        storeName={openStoreKey ? stores[openStoreKey]?.name ?? '' : ''}
        anchorDateKey={anchorDateKey}
        onClose={() => setOpenStoreKey(null)}
        readOnly
      />
    </div>
  );
};