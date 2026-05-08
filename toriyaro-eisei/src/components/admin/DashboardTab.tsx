import { useMemo, useState, type FC } from 'react';
import { StoreRow } from './StoreRow';
import { StoreDetailModal } from './StoreDetailModal';
import { useSubmissionsBulk } from '../../hooks/useSubmissions';
import {
  dateKeyToDate,
  formatDateKeyJa,
  getDateKey,
  getWeekKey,
  isFutureDate,
  isFutureWeek,
  weekKeyToDate,
} from '../../lib/dateUtils';
import type { FilterMode, ReportTab, Store, StoreKey } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
}

export const DashboardTab: FC<Props> = ({ stores }) => {
  const [reportTab, setReportTab] = useState<ReportTab>('daily');
  const [dateKey, setDateKey] = useState<string>(() => getDateKey());
  const [weekKey, setWeekKey] = useState<string>(() => getWeekKey());
  const [filter, setFilter] = useState<FilterMode>('ng');
  const [search, setSearch] = useState('');
  const [openStoreKey, setOpenStoreKey] = useState<StoreKey | null>(null);

  const currentKey = reportTab === 'daily' ? dateKey : weekKey;

  const sortedKeys = useMemo(
    () =>
      Object.keys(stores).sort((a, b) =>
        stores[a].name.localeCompare(stores[b].name, 'ja'),
      ),
    [stores],
  );

  const { data, loading, reload } = useSubmissionsBulk(sortedKeys, reportTab, currentKey);

  const summary = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let ng = 0;
    sortedKeys.forEach((k) => {
      const c = data[k]?.count ?? 0;
      if (c >= 7) ok += 1;
      else if (c > 0) warn += 1;
      else ng += 1;
    });
    return { ok, warn, ng };
  }, [data, sortedKeys]);

  const filteredKeys = useMemo(() => {
    return sortedKeys.filter((k) => {
      const store = stores[k];
      if (search && !store.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (filter === 'ng') {
        const c = data[k]?.count ?? 0;
        if (c >= 7) return false;
      }
      return true;
    });
  }, [sortedKeys, stores, data, search, filter]);

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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface p-1 border border-border shadow-sm flex">
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

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="提出済み" count={summary.ok} tone="ok" />
        <SummaryCard label="一部提出" count={summary.warn} tone="warn" />
        <SummaryCard label="未提出" count={summary.ng} tone="ng" />
      </div>

      <div className="space-y-2">
        <input
          type="search"
          placeholder="店舗名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFilter(filter === 'ng' ? 'all' : 'ng')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              filter === 'ng'
                ? 'bg-accent text-white'
                : 'bg-surface text-text-muted border border-border'
            }`}
          >
            {filter === 'ng' ? '✓ 未提出のみ' : '未提出のみ'}
          </button>
          <button
            type="button"
            onClick={reload}
            className="text-[11px] font-bold text-text-muted hover:text-accent"
          >
            ↻ 更新
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>
      ) : filteredKeys.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">
          {filter === 'ng' ? '未提出の店舗はありません 🎉' : '該当する店舗がありません'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredKeys.map((k) => (
            <StoreRow
              key={k}
              storeName={stores[k].name}
              submission={data[k] ?? null}
              onClick={() => setOpenStoreKey(k)}
            />
          ))}
        </div>
      )}

      <StoreDetailModal
        open={!!openStoreKey}
        storeKey={openStoreKey}
        storeName={openStoreKey ? stores[openStoreKey]?.name ?? '' : ''}
        anchorDateKey={anchorDateKey}
        onClose={() => setOpenStoreKey(null)}
      />
    </div>
  );
};

interface SummaryProps {
  label: string;
  count: number;
  tone: 'ok' | 'warn' | 'ng';
}
const TONE: Record<SummaryProps['tone'], string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  ng: 'bg-ng-bg text-ng',
};
const SummaryCard: FC<SummaryProps> = ({ label, count, tone }) => (
  <div className={`rounded-2xl px-3 py-3 text-center ${TONE[tone]}`}>
    <div className="text-2xl font-black leading-none">{count}</div>
    <div className="mt-1 text-[10px] font-bold">{label}</div>
  </div>
);
