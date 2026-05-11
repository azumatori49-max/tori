import { useMemo, useState } from 'react';
import { useAllSubmissions } from '../../hooks/useSubmissions';
import type { StoreMap } from '../../hooks/useStores';
import {
  formatDateJa,
  getDateKeyFromDate,
  getWeekKeyFromDate,
  isFuture,
} from '../../lib/dateUtils';
import type { FilterMode, ReportTab, StoreKey } from '../../types';
import { getStatus } from '../../types';
import { StoreRow } from './StoreRow';
import { StoreDetailModal } from './StoreDetailModal';

interface Props {
  stores: StoreMap;
}

export const DashboardTab = ({ stores }: Props) => {
  const [reportTab, setReportTab] = useState<ReportTab>('daily');
  const [cursorDate, setCursorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('ng');
  const [openStore, setOpenStore] = useState<StoreKey | null>(null);

  const storeEntries = useMemo(
    () =>
      Object.entries(stores).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name, 'ja')
      ),
    [stores]
  );
  const storeKeys = useMemo(() => storeEntries.map(([k]) => k), [storeEntries]);

  const selectedKey = useMemo(() => {
    return reportTab === 'daily'
      ? getDateKeyFromDate(cursorDate)
      : getWeekKeyFromDate(cursorDate);
  }, [reportTab, cursorDate]);

  const { submissions, loading } = useAllSubmissions(storeKeys, reportTab, selectedKey);

  const summary = useMemo(() => {
    let submitted = 0;
    let partial = 0;
    let none = 0;
    for (const k of storeKeys) {
      const s = getStatus(submissions[k]?.count ?? 0);
      if (s === 'submitted') submitted++;
      else if (s === 'partial') partial++;
      else none++;
    }
    return { submitted, partial, none };
  }, [storeKeys, submissions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return storeEntries.filter(([k, v]) => {
      if (term && !v.name.toLowerCase().includes(term)) return false;
      if (filter === 'ng') {
        const s = getStatus(submissions[k]?.count ?? 0);
        if (s === 'submitted') return false;
      }
      return true;
    });
  }, [storeEntries, search, filter, submissions]);

  const shiftDate = (days: number) => {
    const step = reportTab === 'daily' ? days : days * 7;
    const next = new Date(cursorDate);
    next.setDate(next.getDate() + step);
    if (isFuture(next)) return;
    setCursorDate(next);
  };

  const dateLabel =
    reportTab === 'daily' ? formatDateJa(cursorDate) : `週: ${getWeekKeyFromDate(cursorDate).slice(1)}`;

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex rounded-full bg-surface2 p-1 text-sm font-bold">
        {(['daily', 'weekly'] as ReportTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setReportTab(t)}
            className={`flex-1 rounded-full py-2 transition ${
              reportTab === t ? 'bg-surface text-text shadow-sm' : 'text-text-muted'
            }`}
          >
            {t === 'daily' ? 'デイリー' : 'ウィークリー'}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-surface px-2 py-2">
        <button
          type="button"
          onClick={() => shiftDate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-lg"
          aria-label="前へ"
        >
          ←
        </button>
        <div className="text-sm font-bold text-text">{dateLabel}</div>
        <button
          type="button"
          onClick={() => shiftDate(1)}
          disabled={isFuture(new Date(cursorDate.getTime() + (reportTab === 'daily' ? 1 : 7) * 86400000))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-lg disabled:opacity-30"
          aria-label="次へ"
        >
          →
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <SummaryCard label="提出済み" value={summary.submitted} cls="bg-ok-bg text-ok" />
        <SummaryCard label="一部提出" value={summary.partial} cls="bg-warn-bg text-warn" />
        <SummaryCard label="未提出" value={summary.none} cls="bg-ng-bg text-ng" />
      </div>

      <div className="mb-3 space-y-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="店舗名で検索"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <FilterChip active={filter === 'ng'} onClick={() => setFilter('ng')} label="未提出のみ" />
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="全店舗" />
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-text-muted">読み込み中…</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted">該当する店舗はありません</div>
      ) : (
        <div className="space-y-2 pb-4">
          {filtered.map(([k, v]) => (
            <StoreRow
              key={k}
              storeName={v.name}
              submission={submissions[k] ?? null}
              onClick={() => setOpenStore(k)}
            />
          ))}
        </div>
      )}

      {openStore && (
        <StoreDetailModal
          storeKey={openStore}
          storeName={stores[openStore]?.name ?? ''}
          reportTab={reportTab}
          selectedKey={selectedKey}
          onClose={() => setOpenStore(null)}
        />
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, cls }: { label: string; value: number; cls: string }) => (
  <div className={`rounded-xl px-3 py-2.5 ${cls}`}>
    <div className="text-[10px] font-bold opacity-80">{label}</div>
    <div className="text-xl font-black">{value}</div>
  </div>
);

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
    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
      active ? 'bg-accent text-white' : 'bg-surface text-text-muted border border-border'
    }`}
  >
    {label}
  </button>
);
