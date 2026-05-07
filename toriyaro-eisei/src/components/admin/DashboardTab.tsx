import { useEffect, useMemo, useState } from 'react';
import { sortedStoreEntries } from '../../hooks/useStores';
import { fetchSubmissionsBulk, type SubmissionMap } from '../../hooks/useSubmissions';
import {
  RETENTION_DAYS,
  formatDateJa,
  formatWeekRangeJa,
  getDateKey,
  getDateKeyFromDate,
  getWeekKey,
  getWeekKeyFromDate,
  isBeyondRetention,
  isFutureDate,
  oldestVisibleDate,
  weekKeyToMonday,
} from '../../lib/dateUtils';
import { slotCountFor } from '../../data/slotLabels';
import type { FilterMode, ReportTab, Store, StoreKey } from '../../types';
import { StoreRow } from './StoreRow';
import { StoreDetailModal } from './StoreDetailModal';

interface Props {
  stores: Record<StoreKey, Store>;
}

export const DashboardTab = ({ stores }: Props) => {
  const [reportTab, setReportTab] = useState<ReportTab>('daily');
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('ng');
  const [submissions, setSubmissions] = useState<SubmissionMap>({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<{ key: StoreKey; name: string } | null>(null);

  const periodKey = useMemo(
    () =>
      reportTab === 'daily'
        ? getDateKeyFromDate(cursor)
        : getWeekKeyFromDate(cursor),
    [reportTab, cursor],
  );

  const entries = useMemo(() => sortedStoreEntries(stores), [stores]);
  const storeKeys = useMemo(() => entries.map(([k]) => k), [entries]);

  useEffect(() => {
    if (storeKeys.length === 0) {
      setSubmissions({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSubmissionsBulk(storeKeys, reportTab, periodKey)
      .then((map) => {
        if (!cancelled) setSubmissions(map);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeKeys, reportTab, periodKey]);

  const required = slotCountFor(reportTab);

  const summary = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let ng = 0;
    for (const [key] of entries) {
      const s = submissions[key];
      const c = s?.count ?? 0;
      if (c >= required) ok += 1;
      else if (c > 0) warn += 1;
      else ng += 1;
    }
    return { ok, warn, ng };
  }, [entries, submissions, required]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(([key, store]) => {
      if (q && !store.name.toLowerCase().includes(q)) return false;
      if (filter === 'ng') {
        const c = submissions[key]?.count ?? 0;
        if (c >= required) return false;
      }
      return true;
    });
  }, [entries, submissions, search, filter, required]);

  const shiftCursor = (deltaDays: number) => {
    const next = new Date(cursor);
    if (reportTab === 'daily') {
      next.setDate(next.getDate() + deltaDays);
    } else {
      next.setDate(next.getDate() + deltaDays * 7);
    }
    if (isFutureDate(next)) return;
    if (isBeyondRetention(next)) return;
    setCursor(next);
  };

  const cursorLabel =
    reportTab === 'daily'
      ? formatDateJa(cursor)
      : `週: ${formatWeekRangeJa(weekKeyToMonday(getWeekKeyFromDate(cursor)))}`;

  const isToday =
    reportTab === 'daily'
      ? periodKey === getDateKey()
      : periodKey === getWeekKey();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 bg-surface2 rounded-xl p-1 text-sm font-bold">
        {(['daily', 'weekly'] as ReportTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setReportTab(t)}
            className={`py-2 rounded-lg transition ${
              reportTab === t ? 'bg-surface text-accent shadow-sm' : 'text-text-muted'
            }`}
          >
            {t === 'daily' ? 'デイリー' : 'ウィークリー'}
          </button>
        ))}
      </div>

      <div className="card p-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftCursor(-1)}
          className="btn-ghost px-3 py-2"
          aria-label="前へ"
        >
          ←
        </button>
        <div className="flex flex-col items-center text-center min-w-0">
          <span className="font-sans font-bold text-base truncate">{cursorLabel}</span>
          {isToday ? (
            <span className="text-[10px] text-accent font-mono tracking-wider">TODAY</span>
          ) : (
            <span className="text-[10px] text-text-muted font-mono">{periodKey}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => shiftCursor(1)}
          className="btn-ghost px-3 py-2 disabled:opacity-30"
          disabled={(() => {
            const next = new Date(cursor);
            if (reportTab === 'daily') next.setDate(next.getDate() + 1);
            else next.setDate(next.getDate() + 7);
            return isFutureDate(next);
          })()}
          aria-label="次へ"
        >
          →
        </button>
      </div>
      <p className="text-[11px] text-text-muted text-center -mt-2">
        ※ 写真は{RETENTION_DAYS}日経過すると自動削除されます（保存可能期間: {oldestVisibleDate().getMonth() + 1}/{oldestVisibleDate().getDate()} 以降）。
      </p>

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="提出済み" value={summary.ok} tone="ok" />
        <SummaryCard label="一部提出" value={summary.warn} tone="warn" />
        <SummaryCard label="未提出" value={summary.ng} tone="ng" />
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="search"
          className="input"
          placeholder="店舗名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <FilterChip
            active={filter === 'ng'}
            onClick={() => setFilter('ng')}
            label={`未提出のみ (${summary.warn + summary.ng})`}
          />
          <FilterChip
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={`すべて (${entries.length})`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="text-center text-text-muted text-sm py-8">読み込み中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8">
            {filter === 'ng' ? '未提出の店舗はありません' : '該当する店舗がありません'}
          </div>
        ) : (
          filtered.map(([key, store]) => (
            <StoreRow
              key={key}
              storeName={store.name}
              submission={submissions[key] ?? null}
              required={required}
              onClick={() => setSelected({ key, name: store.name })}
            />
          ))
        )}
      </div>

      <StoreDetailModal
        open={!!selected}
        storeKey={selected?.key ?? null}
        storeName={selected?.name ?? ''}
        dateKey={getDateKeyFromDate(cursor)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'ng';
}) => {
  const TONE: Record<'ok' | 'warn' | 'ng', { fg: string; bg: string }> = {
    ok: { fg: 'text-ok', bg: 'bg-ok-bg' },
    warn: { fg: 'text-warn', bg: 'bg-warn-bg' },
    ng: { fg: 'text-ng', bg: 'bg-ng-bg' },
  };
  const t = TONE[tone];
  return (
    <div className={`${t.bg} rounded-xl p-3 flex flex-col items-start`}>
      <span className="text-[10px] font-mono tracking-widest text-text-muted">{label}</span>
      <span className={`font-sans text-3xl font-black leading-none mt-1 ${t.fg} tabular-nums`}>
        {value}
      </span>
    </div>
  );
};

const FilterChip = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
      active ? 'bg-accent text-white' : 'bg-surface2 text-text-muted hover:bg-border'
    }`}
  >
    {label}
  </button>
);
