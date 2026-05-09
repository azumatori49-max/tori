import { useMemo, useState } from "react";
import {
  dateKeyToDate,
  formatDateJa,
  getDateKey,
  getMondayOf,
  getWeekKey,
  weekKeyToDate,
} from "../../lib/dateUtils";
import { useAllSubmissions } from "../../hooks/useSubmissions";
import { useStores } from "../../hooks/useStores";
import { StoreRow } from "./StoreRow";
import { StoreDetailModal } from "./StoreDetailModal";
import type { ReportTab, StoreKey } from "../../types";

export const DashboardTab = () => {
  const { stores } = useStores();
  const [tab, setTab] = useState<ReportTab>("daily");
  const [dailyDate, setDailyDate] = useState<string>(() => getDateKey());
  const [weeklyKey, setWeeklyKey] = useState<string>(() => getWeekKey());
  const [search, setSearch] = useState("");
  const [ngOnly, setNgOnly] = useState(true);
  const [openStore, setOpenStore] = useState<StoreKey | null>(null);

  const storeKeys = useMemo(() => Object.keys(stores), [stores]);
  const activeKey = tab === "daily" ? dailyDate : weeklyKey;
  const { data, loading } = useAllSubmissions(storeKeys, tab, activeKey);

  const todayKey = getDateKey();
  const thisWeekKey = getWeekKey();
  const isFutureDaily = dateKeyToDate(dailyDate) > dateKeyToDate(todayKey);
  const isFutureWeekly =
    weekKeyToDate(weeklyKey) > weekKeyToDate(thisWeekKey);

  const stepDaily = (dir: -1 | 1) => {
    const d = dateKeyToDate(dailyDate);
    d.setDate(d.getDate() + dir);
    if (dir > 0 && d > dateKeyToDate(todayKey)) return;
    setDailyDate(getDateKey(0, d));
  };
  const stepWeekly = (dir: -1 | 1) => {
    const d = weekKeyToDate(weeklyKey);
    d.setDate(d.getDate() + dir * 7);
    if (dir > 0 && d > weekKeyToDate(thisWeekKey)) return;
    setWeeklyKey(getWeekKey(0, d));
  };

  const sortedKeys = useMemo(
    () =>
      [...storeKeys].sort((a, b) =>
        (stores[a]?.name ?? "").localeCompare(stores[b]?.name ?? "", "ja"),
      ),
    [storeKeys, stores],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    return sortedKeys.filter((k) => {
      const name = stores[k]?.name ?? "";
      if (q && !name.includes(q)) return false;
      const sub = data[k] ?? null;
      const count = sub?.count ?? 0;
      if (ngOnly && count >= 7) return false;
      return true;
    });
  }, [sortedKeys, stores, data, search, ngOnly]);

  const counts = useMemo(() => {
    let ok = 0;
    let warn = 0;
    let ng = 0;
    for (const k of storeKeys) {
      const c = data[k]?.count ?? 0;
      if (c >= 7) ok++;
      else if (c > 0) warn++;
      else ng++;
    }
    return { ok, warn, ng };
  }, [storeKeys, data]);

  const dateLabel =
    tab === "daily"
      ? formatDateJa(dateKeyToDate(dailyDate))
      : `週: ${formatDateJa(weekKeyToDate(weeklyKey))}〜`;

  const dailyForModal =
    tab === "daily"
      ? dailyDate
      : (() => {
          const d = weekKeyToDate(weeklyKey);
          return getDateKey(0, d);
        })();
  const weeklyForModal =
    tab === "weekly"
      ? weeklyKey
      : (() => {
          const d = dateKeyToDate(dailyDate);
          return `W${getDateKey(0, getMondayOf(d))}`;
        })();

  return (
    <div className="px-5 py-4">
      <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-xl border border-border">
        {(["daily", "weekly"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`py-2 text-xs font-bold ${
              tab === t ? "bg-accent text-white" : "bg-surface text-muted"
            }`}
          >
            {t === "daily" ? "デイリー" : "ウィークリー"}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2">
        <button
          type="button"
          aria-label="前へ"
          onClick={() => (tab === "daily" ? stepDaily(-1) : stepWeekly(-1))}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface2"
        >
          ←
        </button>
        <div className="text-sm font-bold text-ink">{dateLabel}</div>
        <button
          type="button"
          aria-label="次へ"
          onClick={() => (tab === "daily" ? stepDaily(1) : stepWeekly(1))}
          disabled={tab === "daily" ? isFutureDaily : isFutureWeekly}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface2 disabled:opacity-30"
        >
          →
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <Summary label="提出済み" value={counts.ok} tone="ok" />
        <Summary label="一部" value={counts.warn} tone="warn" />
        <Summary label="未提出" value={counts.ng} tone="ng" />
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="店舗名で検索"
        className="mb-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
      />

      <button
        type="button"
        onClick={() => setNgOnly((v) => !v)}
        className={`mb-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
          ngOnly ? "bg-ng text-white" : "bg-surface2 text-muted"
        }`}
      >
        {ngOnly ? "✓ 未提出のみ" : "未提出のみ"}
      </button>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">該当する店舗がありません</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((k) => (
            <StoreRow
              key={k}
              storeName={stores[k]?.name ?? k}
              submission={data[k] ?? null}
              onOpen={() => setOpenStore(k)}
            />
          ))}
        </div>
      )}

      {openStore && (
        <StoreDetailModal
          storeKey={openStore}
          storeName={stores[openStore]?.name ?? openStore}
          dailyKey={dailyForModal}
          weeklyKey={weeklyForModal}
          onClose={() => setOpenStore(null)}
        />
      )}
    </div>
  );
};

const TONE = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  ng: "bg-ng-bg text-ng",
} as const;

const Summary = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONE;
}) => (
  <div className={`rounded-xl px-3 py-2 ${TONE[tone]}`}>
    <div className="text-[10px] font-bold opacity-80">{label}</div>
    <div className="font-mono text-xl font-extrabold">{value}</div>
  </div>
);
