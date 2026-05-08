import { useMemo, useState } from 'react';
import { useAdminSubmissions } from '../../hooks/useSubmissions';
import {
  formatDateKeyJa,
  formatWeekKeyJa,
  getDateKey,
  getWeekKey,
  isFutureDate,
  isFutureWeek,
  shiftDateKey,
  shiftWeekKey,
} from '../../lib/dateUtils';
import type { FilterMode, ReportTab, StoreKey } from '../../types';
import type { StoreMap } from '../../hooks/useStores';
import { computeStatus } from '../ui/StatusChip';
import { StoreRow } from './StoreRow';
import { StoreDetailModal } from './StoreDetailModal';

interface Props {
  stores: StoreMap;
}

export const DashboardTab = ({ stores }: Props) => {
  const [reportTab, setReportTab] = useState<ReportTab>('daily');
  const [dateKey, setDateKey] = useState<string>(() => getDateKey());
  const [weekKey, setWeekKey] = useState<string>(() => getWeekKey());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('ng');
  const [detailKey, setDetailKey] = useState<StoreKey | null>(null);

  const periodKey = reportTab === 'daily' ? dateKey : weekKey;
  const sortedKeys = useMemo(
    () =>
      Object.keys(stores).sort((a, b) =>
        (stores[a]?.name ?? '').localeCompare(stores[b]?.name ?? '', 'ja'),
      ),
    [stores],
  );

  const { submissions, loading } = useAdminSubmissions(sortedKeys, reportTab, periodKey);

  const counts = useMemo(() => {
    let submitted = 0;
    let partial = 0;
    let none = 0;
    for (const k of sortedKeys) {
      const s = computeStatus(submissions[k]?.count ?? 0);
      if (s === 'submitted') submitted++;
      else if (s === 'partial') partial++;
      else none++;
    }
    return { submitted, partial, none };
  }, [sortedKeys, submissions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedKeys.filter((key) => {
      const store = stores[key];
      if (!store) return false;
      if (q && !store.name.toLowerCase().includes(q)) return false;
      if (filter === 'ng') {
        const status = computeStatus(submissions[key]?.count ?? 0);
        if (status === 'submitted') return false;
      }
      return true;
    });
  }, [sortedKeys, stores, submissions, search, filter]);

  const shift = (delta: number) => {
    if (reportTab === 'daily') {
      const next = shiftDateKey(dateKey, delta);
      if (delta > 0 && isFutureDate(next)) return;
      setDateKey(next);
    } else {
      const next = shiftWeekKey(weekKey, delta);
      if (delta > 0 && isFutureWeek(next)) return;
      setWeekKey(next);
    }
  };

  const canForward = reportTab === 'daily'
    ? !isFutureDate(shiftDateKey(dateKey, 1))
    : !isFutureWeek(shiftWeekKey(weekKey, 1));

  const detailDateKey =
    reportTab === 'daily' ? dateKey : weekKey.replace(/^W/, '');

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-1 flex">
        {(['daily', 'weekly'] as ReportTab[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setReportTab(t)}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition ${
              reportTab === t ? 'bg-accent text-white' : 'text-text-muted'
            }`}
          >
            {t === 'daily' ? 'デイリー' : 'ウィークリー'}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-2xl px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="w-9 h-9 rounded-full hover:bg-surface2 flex items-center justify-center"
          aria-label="前へ"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-xs font-bold">
            {reportTab === 'daily' ? formatDateKeyJa(dateKey) : formatWeekKeyJa(weekKey)}
          </p>
          <p className="text-[10px] text-text-muted">
            {reportTab === 'daily' ? dateKey : weekKey}
          </p>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={!canForward}
          className="w-9 h-9 rounded-full hover:bg-surface2 disabled:opacity-30 flex items-center justify-center"
          aria-label="次へ"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="提出済み" value={counts.submitted} tone="ok" />
        <SummaryCard label="一部提出" value={counts.partial} tone="warn" />
        <SummaryCard label="未提出" value={counts.none} tone="ng" />
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="店舗名で検索..."
          className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <FilterChip
            active={filter === 'ng'}
            onClick={() => setFilter('ng')}
            label="未提出のみ"
          />
          <FilterChip
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label="すべて"
          />
        </div>
      </div>

      {loading && (
        <p className="text-center text-text-muted text-sm py-4">読み込み中...</p>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && !loading && (
          <p className="text-center text-text-muted text-sm py-6">
            該当する店舗はありません
          </p>
        )}
        {filtered.map((key) => (
          <StoreRow
            key={key}
            storeName={stores[key]?.name ?? '(不明)'}
            submission={submissions[key] ?? null}
            onClick={() => setDetailKey(key)}
          />
        ))}
      </div>

      <StoreDetailModal
        open={detailKey != null}
        storeKey={detailKey}
        storeName={detailKey ? stores[detailKey]?.name ?? null : null}
        dateKey={detailDateKey}
        onClose={() => setDetailKey(null)}
      />
    </div>
  );
};

interface SummaryCardProps {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'ng';
}

const TONES: Record<SummaryCardProps['tone'], string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  ng: 'bg-ng-bg text-ng',
};

const SummaryCard = ({ label, value, tone }: SummaryCardProps) => (
  <div className={`rounded-xl p-3 ${TONES[tone]}`}>
    <p className="text-[11px] font-bold opacity-80">{label}</p>
    <p className="text-2xl font-black tabular-nums">{value}</p>
  </div>
);

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

const FilterChip = ({ active, onClick, label }: FilterChipProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${
      active
        ? 'bg-accent text-white'
        : 'bg-surface text-text-muted border border-border'
    }`}
  >
    {label}
  </button>
);
