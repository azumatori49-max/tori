import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { fetchSubmissionsForKey } from '../../hooks/useSubmissions';
import { targetForType } from '../../data/checkItems';
import {
  formatDateKeyShort,
  formatMonthKeyJa,
  getDateKey,
  getMonthKey,
  monthKeyToDate,
} from '../../lib/dateUtils';
import type { Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
}

/** 未提出カウントの集計開始日（この日より前は数えない） — StoreTopScreen と揃える */
const MISS_TRACK_START = '2026-07-11';

const pad = (n: number) => String(n).padStart(2, '0');

interface MissDay {
  d: string;
  c: number;
  t: number;
}

const countPhotos = (raw: unknown): number => {
  if (!raw) return 0;
  if (Array.isArray(raw)) {
    return raw.filter((x) => typeof x === 'string' && x.length > 0).length;
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).filter(
      (x) => typeof x === 'string' && x.length > 0,
    ).length;
  }
  return 0;
};

/** 月キーの (y, m, 月の日数) を返す */
const monthMeta = (monthKey: string): { y: number; m: number; days: number } => {
  const d = monthKeyToDate(monthKey);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const days = new Date(y, m, 0).getDate();
  return { y, m, days };
};

/** 対象月の集計対象日リスト（当日は含めない・MISS_TRACK_START より前は含めない） */
const buildTargetDates = (monthKey: string): string[] => {
  const { y, m, days } = monthMeta(monthKey);
  const todayKey = getDateKey();
  const [ty, tm, td] = todayKey.split('-').map(Number);

  // 上限日: 過去の月なら末日、当月なら「昨日」(td-1)
  let upper = days;
  if (y === ty && m === tm) upper = td - 1;
  if (upper < 1) return [];

  const from = MISS_TRACK_START;
  const out: string[] = [];
  for (let day = 1; day <= upper; day += 1) {
    const k = `${y}-${pad(m)}-${pad(day)}`;
    if (k >= from) out.push(k);
  }
  return out;
};

const buildReportText = (
  monthKey: string,
  storeOrder: StoreKey[],
  stores: Record<StoreKey, Store>,
  misses: Record<StoreKey, MissDay[]>,
): string => {
  const header = `【衛生管理 月次レポート ${formatMonthKeyJa(monthKey)}】`;

  const targets = buildTargetDates(monthKey);
  const range = targets.length === 0
    ? '対象日なし'
    : `${formatDateKeyShort(targets[0])}〜${formatDateKeyShort(targets[targets.length - 1])}`;
  const period = `集計期間：${range}（当日分は含まず）`;

  const noMissKeys: StoreKey[] = [];
  const withMissKeys: StoreKey[] = [];
  storeOrder.forEach((k) => {
    if ((misses[k]?.length ?? 0) === 0) noMissKeys.push(k);
    else withMissKeys.push(k);
  });
  withMissKeys.sort(
    (a, b) => (misses[b]?.length ?? 0) - (misses[a]?.length ?? 0),
  );

  const noMissBlock =
    noMissKeys.length === 0
      ? `■ 未提出なし：0店舗`
      : `■ 未提出なし：${noMissKeys.length}店舗\n${noMissKeys
          .map((k) => stores[k].name)
          .join('、')}`;

  const withMissBlock =
    withMissKeys.length === 0
      ? `■ 未提出あり：0店舗`
      : `■ 未提出あり：${withMissKeys.length}店舗\n${withMissKeys
          .map((k) => {
            const list = misses[k] ?? [];
            const detail = list
              .map((m) =>
                m.c > 0
                  ? `${formatDateKeyShort(m.d)}(${m.c}/${m.t}枚)`
                  : formatDateKeyShort(m.d),
              )
              .join('、');
            return `・${stores[k].name}：${list.length}回（${detail}）`;
          })
          .join('\n')}`;

  return [header, period, '', noMissBlock, '', withMissBlock].join('\n');
};

export const MonthlyReportCard: FC<Props> = ({ stores }) => {
  const [open, setOpen] = useState(false);
  const [monthKey, setMonthKey] = useState<string>(() => getMonthKey());
  const [loading, setLoading] = useState(false);
  const [misses, setMisses] = useState<Record<StoreKey, MissDay[]> | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const currentMonthKey = getMonthKey();
  const canGoNext = monthKey < currentMonthKey;

  const sortedKeys = useMemo(
    () =>
      Object.keys(stores).sort((a, b) =>
        stores[a].name.localeCompare(stores[b].name, 'ja'),
      ),
    [stores],
  );

  const targetDates = useMemo(() => buildTargetDates(monthKey), [monthKey]);

  useEffect(() => {
    if (!open) return;
    if (sortedKeys.length === 0) {
      setMisses({});
      return;
    }
    if (targetDates.length === 0) {
      const empty: Record<StoreKey, MissDay[]> = {};
      sortedKeys.forEach((k) => {
        empty[k] = [];
      });
      setMisses(empty);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setMisses(null);
    Promise.all(
      targetDates.map((k) => fetchSubmissionsForKey(sortedKeys, 'daily', k)),
    )
      .then((results) => {
        if (cancelled) return;
        const next: Record<StoreKey, MissDay[]> = {};
        sortedKeys.forEach((k) => {
          next[k] = [];
        });
        results.forEach((dayMap, idx) => {
          const dayKey = targetDates[idx];
          sortedKeys.forEach((k) => {
            const created = stores[k]?.createdAt?.slice(0, 10);
            if (created && dayKey < created) return;
            const sub = dayMap[k];
            const target = targetForType('daily', k);
            const c = countPhotos(sub?.photos);
            const submitted = !!sub?.viaLine || c >= target;
            if (!submitted) next[k].push({ d: dayKey, c, t: target });
          });
        });
        setMisses(next);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setMisses(null);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sortedKeys.join(','), targetDates.join(',')]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const reportText = useMemo(() => {
    if (!misses) return '';
    return buildReportText(monthKey, sortedKeys, stores, misses);
  }, [monthKey, sortedKeys, stores, misses]);

  const onCopy = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 拒否時: フォールバック (textarea 選択)
      const ta = document.createElement('textarea');
      ta.value = reportText;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
      } catch {
        // 諦め
      }
      document.body.removeChild(ta);
    }
  };

  const withMissCount = useMemo(() => {
    if (!misses) return 0;
    return sortedKeys.filter((k) => (misses[k]?.length ?? 0) > 0).length;
  }, [misses, sortedKeys]);
  const noMissCount = sortedKeys.length - withMissCount;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <h2 className="text-xs font-bold">月次レポート（デイリー提出状況）</h2>
        <span className="text-text-muted">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-3 py-2">
            <button
              type="button"
              onClick={() => setMonthKey((k) => getMonthKey(-1, monthKeyToDate(k)))}
              className="rounded-lg px-2 py-1 text-sm font-bold text-text-muted hover:text-accent active:scale-95"
              aria-label="前の月"
            >
              ←
            </button>
            <span className="text-sm font-bold">{formatMonthKeyJa(monthKey)}</span>
            <button
              type="button"
              onClick={() =>
                canGoNext && setMonthKey((k) => getMonthKey(1, monthKeyToDate(k)))
              }
              disabled={!canGoNext}
              className="rounded-lg px-2 py-1 text-sm font-bold text-text-muted enabled:hover:text-accent enabled:active:scale-95 disabled:opacity-30"
              aria-label="次の月"
            >
              →
            </button>
          </div>

          {targetDates.length === 0 && (
            <p className="rounded-lg bg-warn-bg px-3 py-2 text-[11px] font-bold text-warn">
              この月には集計対象の日がありません（集計開始日 {MISS_TRACK_START} より前、または当月の初日以前）。
            </p>
          )}

          {loading && (
            <p className="text-xs text-text-muted">集計中…</p>
          )}

          {!loading && misses && targetDates.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="rounded-full bg-ok-bg px-2 py-0.5 text-ok">
                未提出なし {noMissCount}店舗
              </span>
              <span className="rounded-full bg-ng-bg px-2 py-0.5 text-ng">
                未提出あり {withMissCount}店舗
              </span>
            </div>
          )}

          {!loading && misses && (
            <textarea
              readOnly
              value={reportText}
              className="h-64 w-full resize-y rounded-xl border border-border bg-surface2 p-3 text-[11px] leading-relaxed text-text focus:outline-none"
            />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              disabled={!reportText || loading}
              className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
            >
              テキストをコピー
            </button>
            {copied && (
              <span className="rounded-full bg-ok-bg px-3 py-1 text-xs font-bold text-ok">
                コピーしました
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
