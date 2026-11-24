import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { MonthlyMatrix } from './MonthlyMatrix';
import { StoreRow } from './StoreRow';
import { StoreDetailModal } from './StoreDetailModal';
import { useSubmissionsBulk } from '../../hooks/useSubmissions';
import { targetForType } from '../../data/checkItems';
import { isStoreOpenFor } from '../../lib/storeOpening';
import {
  dateKeyToDate,
  formatDateKeyJa,
  formatDateKeyShort,
  formatMonthKeyJa,
  formatWeekKeyRange,
  getDateKey,
  getMonthKey,
  getWeekKey,
  isFutureDate,
  isFutureMonth,
  isFutureWeek,
  monthKeyToDate,
  weekKeyToDate,
} from '../../lib/dateUtils';
import type { ReportTab, Store, StoreKey } from '../../types';

/** 一覧の絞り込み。'todo' = 未完了（未提出＋一部提出） */
type StatusFilter = 'all' | 'todo' | 'ok' | 'warn' | 'ng';
type StoreStatus = 'ok' | 'warn' | 'ng';

const TYPE_LABEL: Record<ReportTab, string> = { daily: 'デイリー', weekly: 'ウィークリー', monthly: 'マンスリー' };

interface Props {
  stores: Record<StoreKey, Store>;
}

export const DashboardTab: FC<Props> = ({ stores }) => {
  const [reportTab, setReportTab] = useState<ReportTab>('daily');
  const [dateKey, setDateKey] = useState<string>(() => getDateKey());
  const [weekKey, setWeekKey] = useState<string>(() => getWeekKey());
  const [monthKey, setMonthKey] = useState<string>(() => getMonthKey());
  const [filter, setFilter] = useState<StatusFilter>('todo');
  // デイリーの表示方法（PCのみ切り替え可）: 一覧 / 月間の表
  const [view, setView] = useState<'list' | 'matrix'>('list');
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  // 詳細を開く日付（月間の表のマスから開いたときは、その日）
  const [openDateKey, setOpenDateKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [openStoreKey, setOpenStoreKey] = useState<StoreKey | null>(null);

  const currentKey =
    reportTab === 'daily' ? dateKey : reportTab === 'weekly' ? weekKey : monthKey;

  const sortedKeys = useMemo(
    () =>
      Object.keys(stores)
        // 表示中の日・週・月の時点でまだオープンしていない店舗は出さない
        .filter((k) => isStoreOpenFor(stores[k].createdAt, reportTab, currentKey, getDateKey()))
        .sort((a, b) => stores[a].name.localeCompare(stores[b].name, 'ja')),
    [stores, reportTab, currentKey],
  );

  const { data, loading, reload } = useSubmissionsBulk(sortedKeys, reportTab, currentKey);

  /** 店舗ごとの状態（提出済み／一部提出／未提出）。LINE報告は count が規定枚数になるので提出済み */
  const statusOf = useMemo(() => {
    const map: Record<StoreKey, StoreStatus> = {};
    sortedKeys.forEach((k) => {
      const c = data[k]?.count ?? 0;
      const t = targetForType(reportTab, k, currentKey);
      map[k] = c >= t ? 'ok' : c > 0 ? 'warn' : 'ng';
    });
    return map;
  }, [data, sortedKeys, reportTab, currentKey]);

  const summary = useMemo(() => {
    const out = { ok: 0, warn: 0, ng: 0 };
    sortedKeys.forEach((k) => {
      out[statusOf[k]] += 1;
    });
    return out;
  }, [sortedKeys, statusOf]);

  const filteredKeys = useMemo(() => {
    return sortedKeys.filter((k) => {
      const store = stores[k];
      if (search && !store.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      const st = statusOf[k];
      if (filter === 'todo') return st !== 'ok';
      if (filter === 'all') return true;
      return st === filter;
    });
  }, [sortedKeys, stores, statusOf, search, filter]);

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  /** いま表示している種類・日付の「未提出」「一部提出」の店舗名をコピーする（催促の連絡用） */
  const copyTodoStores = async () => {
    const note = (msg: string) => {
      setCopyNote(msg);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopyNote(null), 2500);
    };
    const none = sortedKeys.filter((k) => statusOf[k] === 'ng');
    const partial = sortedKeys.filter((k) => statusOf[k] === 'warn');
    if (none.length === 0 && partial.length === 0) {
      note('未提出の店舗はありません');
      return;
    }
    const when =
      reportTab === 'daily'
        ? formatDateKeyShort(dateKey) + `（${'日月火水木金土'[dateKeyToDate(dateKey).getDay()]}）`
        : reportTab === 'weekly'
          ? formatWeekKeyRange(weekKey)
          : formatMonthKeyJa(monthKey);
    const lines = [`【衛生チェック ${TYPE_LABEL[reportTab]} ${when}】`];
    if (none.length > 0) lines.push(`未提出 ${none.length}店舗：${none.map((k) => stores[k].name).join('、')}`);
    if (partial.length > 0) {
      lines.push(
        `一部提出 ${partial.length}店舗：${partial
          .map((k) => `${stores[k].name}（${data[k]?.count ?? 0}/${targetForType(reportTab, k, currentKey)}枚）`)
          .join('、')}`,
      );
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      note('コピーしました');
    } catch {
      note('コピーできませんでした');
    }
  };

  const shiftDate = (delta: number) => {
    if (reportTab === 'daily') {
      const d = dateKeyToDate(dateKey);
      d.setDate(d.getDate() + delta);
      const next = getDateKey(0, d);
      if (delta > 0 && isFutureDate(next)) return;
      setDateKey(next);
    } else if (reportTab === 'weekly') {
      const d = weekKeyToDate(weekKey);
      d.setDate(d.getDate() + delta * 7);
      const next = getWeekKey(0, d);
      if (delta > 0 && isFutureWeek(next)) return;
      setWeekKey(next);
    } else {
      const d = monthKeyToDate(monthKey);
      d.setMonth(d.getMonth() + delta);
      const next = getMonthKey(0, d);
      if (delta > 0 && isFutureMonth(next)) return;
      setMonthKey(next);
    }
  };

  const canForward =
    reportTab === 'daily'
      ? dateKey < getDateKey()
      : reportTab === 'weekly'
        ? weekKey < getWeekKey()
        : monthKey < getMonthKey();

  const dateLabel =
    reportTab === 'daily'
      ? formatDateKeyJa(dateKey)
      : reportTab === 'weekly'
        ? `週: ${weekKey.slice(1)}`
        : formatMonthKeyJa(monthKey);

  const anchorDateKey =
    reportTab === 'daily'
      ? dateKey
      : reportTab === 'weekly'
        ? getDateKey(0, weekKeyToDate(weekKey))
        : getDateKey(0, monthKeyToDate(monthKey));

  const showMatrix = reportTab === 'daily' && view === 'matrix';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface p-1 border border-border shadow-sm flex">
        {(['daily', 'weekly', 'monthly'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setReportTab(t)}
            aria-pressed={reportTab === t}
            className={`min-h-[44px] flex-1 rounded-xl py-2 text-xs font-bold transition ${
              reportTab === t ? 'bg-accent text-white shadow-sm' : 'text-text-muted'
            }`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* デイリーの表示切り替え（PCのみ）: 一覧／月間の表 */}
      {reportTab === 'daily' && (
        <div className="hidden justify-end lg:flex">
          <div className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-sm">
            {(['list', 'matrix'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`min-h-[36px] rounded-lg px-4 text-xs font-bold ${
                  view === v ? 'bg-text text-white' : 'text-text-muted'
                }`}
              >
                {v === 'list' ? '一覧' : '月間'}
              </button>
            ))}
          </div>
        </div>
      )}

      {showMatrix ? (
        <div className="hidden lg:block">
          <MonthlyMatrix
            stores={stores}
            onOpenCell={(k, d) => {
              setOpenDateKey(d);
              setOpenStoreKey(k);
            }}
          />
        </div>
      ) : null}

      {/* 月間の表はPCだけ。スマホ幅では常に一覧を出す */}
      <div className={showMatrix ? 'space-y-4 lg:hidden' : 'space-y-4'}>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border"
            aria-label="前へ"
          >
            ←
          </button>
          <div className="text-sm font-bold">{dateLabel}</div>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            disabled={!canForward}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border disabled:opacity-30"
            aria-label="次へ"
          >
            →
          </button>
        </div>

        {/* 数字を押すと、その状態の店舗だけに絞り込む（もう一度押すと解除） */}
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { key: 'ok', label: '提出済み', count: summary.ok },
              { key: 'warn', label: '一部提出', count: summary.warn },
              { key: 'ng', label: '未提出', count: summary.ng },
            ] as const
          ).map((c) => (
            <SummaryCard
              key={c.key}
              label={c.label}
              count={c.count}
              tone={c.key}
              selected={filter === c.key}
              onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
            />
          ))}
        </div>

        <div className="space-y-2">
          <input
            type="search"
            placeholder="店舗名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="店舗名で検索"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFilter(filter === 'todo' ? 'all' : 'todo')}
              aria-pressed={filter === 'todo'}
              className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-4 text-xs font-bold transition ${
                filter === 'todo'
                  ? 'bg-text text-white'
                  : 'bg-surface text-text-muted border border-border'
              }`}
            >
              {filter === 'todo' ? '✓ 未完了のみ' : '未完了のみ'}
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={copyTodoStores}
                disabled={loading}
                className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-surface px-4 text-xs font-bold text-text disabled:opacity-50"
              >
                未提出の店舗をコピー
              </button>
              <button
                type="button"
                onClick={reload}
                className="inline-flex min-h-[44px] items-center px-3 text-xs font-bold text-text-muted hover:text-accent"
              >
                ↻ 更新
              </button>
            </div>
          </div>
          {copyNote && (
            <p role="status" className="rounded-lg bg-ok-bg px-3 py-2 text-xs font-bold text-ok">
              {copyNote}
            </p>
          )}
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>
        ) : filteredKeys.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            {filter === 'todo' ? '未提出の店舗はありません' : '該当する店舗がありません'}
          </p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {filteredKeys.map((k) => (
              <StoreRow
                key={k}
                storeKey={k}
                storeName={stores[k].name}
                type={reportTab}
                dateOrWeekKey={currentKey}
                submission={data[k] ?? null}
                onClick={() => {
                  setOpenDateKey(null);
                  setOpenStoreKey(k);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <StoreDetailModal
        open={!!openStoreKey}
        storeKey={openStoreKey}
        storeName={openStoreKey ? stores[openStoreKey]?.name ?? '' : ''}
        anchorDateKey={openDateKey ?? anchorDateKey}
        onClose={() => setOpenStoreKey(null)}
        onChanged={reload}
      />
    </div>
  );
};

interface SummaryProps {
  label: string;
  count: number;
  tone: 'ok' | 'warn' | 'ng';
  selected: boolean;
  onClick: () => void;
}
const TONE: Record<SummaryProps['tone'], string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  ng: 'bg-ng-bg text-ng',
};
const SummaryCard: FC<SummaryProps> = ({ label, count, tone, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    title={selected ? '絞り込みを解除' : `${label}の店舗だけ表示`}
    className={`rounded-2xl border-2 px-3 py-3 text-center transition active:scale-[0.98] ${TONE[tone]} ${
      selected ? 'border-current' : 'border-transparent'
    }`}
  >
    <div className="text-2xl font-black leading-none">{count}</div>
    <div className="mt-1 text-xs font-bold">{label}</div>
  </button>
);
