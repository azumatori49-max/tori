import { useEffect, useMemo, useState, type FC } from 'react';
import { fetchSubmissionRange } from '../../hooks/useSubmissions';
import { formatMonthKeyJa, getDateKey, getMonthKey, monthKeyToDate } from '../../lib/dateUtils';
import { MISS_TRACK_START, countSubmittedPhotos } from '../../lib/missTrack';
import { targetForType } from '../../data/checkItems';
import type { Store, StoreKey, Submission } from '../../types';

interface Props {
  stores: Record<StoreKey, Store>;
  /** マスを押したとき（その店舗・その日の詳細を開く） */
  onOpenCell: (storeKey: StoreKey, dateKey: string) => void;
}

/** ○=提出済み △=一部提出 ×=未提出 L=LINE報告 －=数えない日 */
type Cell = 'ok' | 'partial' | 'none' | 'line' | 'skip';

const MARK: Record<Cell, string> = { ok: '○', partial: '△', none: '×', line: 'L', skip: '－' };
const CELL_CLS: Record<Cell, string> = {
  ok: 'text-ok',
  partial: 'bg-warn-bg text-warn font-bold',
  none: 'bg-ng-bg text-ng font-bold',
  line: 'text-ok font-bold',
  skip: 'text-text-muted',
};
const CELL_LABEL: Record<Cell, string> = {
  ok: '提出済み',
  partial: '一部提出',
  none: '未提出',
  line: 'LINE報告',
  skip: '対象外',
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const WEEKDAY = '日月火水木金土';

/**
 * デイリー提出の月間一覧（PC用）。行＝店舗、列＝日。
 * 判定は月次レポートと同じ: 朝9時区切りの業務日、一部提出は未提出扱い、LINE報告は提出扱い、
 * オープン日より前・集計開始日より前・今日より先は数えない。当日は表示するが未提出回数には含めない。
 */
export const MonthlyMatrix: FC<Props> = ({ stores, onOpenCell }) => {
  const [monthKey, setMonthKey] = useState<string>(() => getMonthKey());
  const [sortBy, setSortBy] = useState<'name' | 'miss'>('name');
  const [data, setData] = useState<Record<StoreKey, Record<string, Submission>> | 'error' | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const todayKey = getDateKey();
  const currentMonthKey = getMonthKey();

  const dayKeys = useMemo(() => {
    const d = monthKeyToDate(monthKey);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const days = new Date(y, m, 0).getDate();
    return Array.from({ length: days }, (_, i) => `${y}-${pad2(m)}-${pad2(i + 1)}`);
  }, [monthKey]);

  const nameSortedKeys = useMemo(
    () => Object.keys(stores).sort((a, b) => stores[a].name.localeCompare(stores[b].name, 'ja')),
    [stores],
  );
  const storeKeysSig = nameSortedKeys.join(',');

  // 表示するときに初めて読み込む（店舗ごとに、その月ぶんを1回で読む）
  useEffect(() => {
    if (nameSortedKeys.length === 0) {
      setData({});
      return;
    }
    let cancelled = false;
    setData(null);
    Promise.all(
      nameSortedKeys.map(async (k) => [k, await fetchSubmissionRange(k, 'daily', dayKeys[0], dayKeys[dayKeys.length - 1])] as const),
    )
      .then((entries) => {
        if (!cancelled) setData(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setData('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKeysSig, dayKeys.join(','), reloadToken]);

  const rows = useMemo(() => {
    if (!data || data === 'error') return [];
    const out = nameSortedKeys.map((k) => {
      const created = stores[k]?.createdAt?.slice(0, 10);
      const target = targetForType('daily', k);
      let miss = 0;
      const cells = dayKeys.map((d): { cell: Cell; count: number } => {
        if (d > todayKey || d < MISS_TRACK_START || (created && d < created)) return { cell: 'skip', count: 0 };
        const sub = data[k]?.[d];
        const count = countSubmittedPhotos(sub?.photos);
        const cell: Cell = sub?.viaLine ? 'line' : count >= target ? 'ok' : count > 0 ? 'partial' : 'none';
        // 当日は未提出回数に含めない
        if (d < todayKey && (cell === 'partial' || cell === 'none')) miss += 1;
        return { cell, count };
      });
      return { key: k, name: stores[k].name, target, cells, miss };
    });
    if (sortBy === 'miss') out.sort((a, b) => b.miss - a.miss || a.name.localeCompare(b.name, 'ja'));
    return out;
  }, [data, nameSortedKeys, stores, dayKeys, todayKey, sortBy]);

  const shiftMonth = (delta: number) => {
    const d = monthKeyToDate(monthKey);
    d.setMonth(d.getMonth() + delta);
    const next = `M${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    if (next > currentMonthKey) return;
    setMonthKey(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border"
            aria-label="前の月"
          >
            ←
          </button>
          <div className="min-w-[7.5rem] text-center text-sm font-bold">{formatMonthKeyJa(monthKey)}</div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={monthKey >= currentMonthKey}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border disabled:opacity-30"
            aria-label="次の月"
          >
            →
          </button>
        </div>
        <p className="text-xs text-text-muted">
          ○ 提出済み　△ 一部提出　× 未提出　L LINE報告　－ 対象外（オープン前・集計開始前・先の日）
        </p>
        <div className="flex items-center gap-1">
          <div className="inline-flex rounded-xl border border-border bg-surface p-1">
            {(['name', 'miss'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSortBy(v)}
                aria-pressed={sortBy === v}
                className={`min-h-[36px] rounded-lg px-3 text-xs font-bold ${
                  sortBy === v ? 'bg-text text-white' : 'text-text-muted'
                }`}
              >
                {v === 'name' ? '店舗名順' : '未提出の多い順'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((t) => t + 1)}
            className="inline-flex min-h-[44px] items-center px-3 text-xs font-bold text-text-muted hover:text-accent"
          >
            ↻ 更新
          </button>
        </div>
      </div>

      {data === null ? (
        <p className="py-8 text-center text-sm text-text-muted">集計中…</p>
      ) : data === 'error' ? (
        <p className="rounded-xl bg-ng-bg px-3 py-3 text-sm font-bold text-ng">
          月間一覧を読み込めませんでした。「↻ 更新」を押してもう一度お試しください。
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 min-w-[12rem] border-b border-r border-border bg-surface px-3 py-2 text-left font-bold">
                  店舗
                </th>
                {dayKeys.map((d) => {
                  const dt = new Date(`${d}T00:00:00`);
                  const wd = dt.getDay();
                  const isToday = d === todayKey;
                  return (
                    <th
                      key={d}
                      className={`sticky top-0 z-10 min-w-[2rem] border-b border-border px-1 py-1 text-center font-bold ${
                        isToday ? 'bg-accent text-white' : 'bg-surface'
                      } ${!isToday && wd === 0 ? 'text-ng' : ''} ${!isToday && wd === 6 ? 'text-blue-700' : ''}`}
                      title={isToday ? '今日（未提出回数には含めません）' : undefined}
                    >
                      <div>{dt.getDate()}</div>
                      <div className="font-normal">{WEEKDAY[wd]}</div>
                    </th>
                  );
                })}
                <th className="sticky right-0 top-0 z-20 min-w-[4.5rem] border-b border-l border-border bg-surface px-2 py-2 text-center font-bold">
                  未提出
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[16rem] truncate border-b border-r border-border bg-surface px-3 py-1.5 text-left font-bold"
                    title={row.name}
                  >
                    {row.name}
                  </th>
                  {row.cells.map(({ cell, count }, i) => {
                    const d = dayKeys[i];
                    const isToday = d === todayKey;
                    const label = `${row.name} ${Number(d.slice(5, 7))}/${Number(d.slice(8))} ${CELL_LABEL[cell]}${
                      cell === 'partial' ? `（${count}/${row.target}枚）` : ''
                    }`;
                    return (
                      <td
                        key={d}
                        className={`border-b border-border p-0 text-center ${isToday ? 'border-x-2 border-x-accent' : ''}`}
                      >
                        {cell === 'skip' ? (
                          <span className={`block px-1 py-1.5 ${CELL_CLS[cell]}`} title={label}>
                            {MARK[cell]}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenCell(row.key, d)}
                            className={`block w-full px-1 py-1.5 hover:outline hover:outline-2 hover:outline-accent ${CELL_CLS[cell]}`}
                            title={label}
                            aria-label={label}
                          >
                            {MARK[cell]}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={`sticky right-0 z-10 border-b border-l border-border bg-surface px-2 py-1.5 text-center font-bold ${
                      row.miss > 0 ? 'text-ng' : 'text-ok'
                    }`}
                  >
                    {row.miss}回
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
