import type { DB } from "./db";
import type {
  DataSourceBadge,
  MfDeposit,
  PosSale,
  Review,
  ReviewStatus,
  Store,
} from "./types";
import { dateOf, daysInMonth, todayStringLocal } from "./recon-util";

export type DayRow = {
  date: string;
  day: number;
  deposit: number | null; // 口座入金(実効)
  depositCsv: number | null;
  depositManual: number | null;
  sales: number | null; // POS売上(実効) = 現金売上
  salesCsv: number | null;
  salesCard: number | null;
  salesManual: number | null;
  diff: number | null;
  source: DataSourceBadge;
  hasPhotos: boolean;
  hasComment: boolean;
  report: {
    comment: string | null;
    manualDeposit: number | null;
    manualSales: number | null;
  } | null;
  status: ReviewStatus | null; // null = データなし(空欄)
  auto: boolean; // 差額0による自動確認済
  memo: string | null;
};

export type MonthGrid = {
  store: Store;
  month: string;
  rows: DayRow[];
  totals: { deposit: number; sales: number; diff: number };
  unconfirmedCount: number;
  unconfirmedDiffTotal: number;
};

// 写真本体(photos_json)は重いので一覧では読まず、有無だけを持つ
type ReportLite = {
  store_id: string;
  date: string;
  manual_deposit: number | null;
  manual_sales: number | null;
  comment: string | null;
  photos_len: number;
};

export type ReconData = {
  deposits: MfDeposit[];
  sales: PosSale[];
  reports: ReportLite[];
  reviews: Review[];
};

// 複数店舗・期間分をまとめて4クエリで読み込む（店舗×月ごとに問い合わせない）
export async function loadReconData(
  db: DB,
  storeIds: string[],
  from: string,
  to: string
): Promise<ReconData> {
  if (storeIds.length === 0) {
    return { deposits: [], sales: [], reports: [], reviews: [] };
  }
  const marks = storeIds.map(() => "?").join(",");
  const params = [...storeIds, from, to];
  const [deposits, sales, reports, reviews] = await Promise.all([
    db.all<MfDeposit>(
      `SELECT * FROM mf_deposits WHERE store_id IN (${marks}) AND date >= ? AND date <= ?`,
      params
    ),
    db.all<PosSale>(
      `SELECT * FROM pos_sales WHERE store_id IN (${marks}) AND date >= ? AND date <= ?`,
      params
    ),
    db.all<ReportLite>(
      `SELECT store_id, date, manual_deposit, manual_sales, comment, LENGTH(photos_json) AS photos_len
       FROM daily_reports WHERE store_id IN (${marks}) AND date >= ? AND date <= ?`,
      params
    ),
    db.all<Review>(
      `SELECT * FROM reviews WHERE store_id IN (${marks}) AND date >= ? AND date <= ?`,
      params
    ),
  ]);
  return { deposits, sales, reports, reviews };
}

// 読み込み済みデータから1店舗・1か月分のグリッドを組み立てる（DBアクセスなし）
export function computeMonthGrid(
  store: Store,
  month: string,
  data: ReconData
): MonthGrid {
  const deposits = data.deposits.filter((d) => d.store_id === store.id);
  const sales = data.sales.filter((s) => s.store_id === store.id);
  const reports = data.reports.filter((r) => r.store_id === store.id);
  const reviews = data.reviews.filter((r) => r.store_id === store.id);

  const rows: DayRow[] = [];
  const days = daysInMonth(month);
  for (let day = 1; day <= days; day++) {
    const date = dateOf(month, day);
    const dayDepositsCsv = deposits.filter(
      (d) => d.date === date && d.source === "csv"
    );
    const dayDepositsManual = deposits.filter(
      (d) => d.date === date && d.source === "manual"
    );
    const daySale = sales.find((s) => s.date === date);
    const report = reports.find((r) => r.date === date) ?? null;
    const review = reviews.find((r) => r.date === date) ?? null;

    const depositCsv =
      dayDepositsCsv.length > 0
        ? dayDepositsCsv.reduce((s, d) => s + d.amount, 0)
        : null;
    const reportManualDeposit = report?.manual_deposit ?? null;
    const manualDepositRows =
      dayDepositsManual.length > 0
        ? dayDepositsManual.reduce((s, d) => s + d.amount, 0)
        : null;
    const depositManual = reportManualDeposit ?? manualDepositRows;
    // 店舗手動入力があれば実効値として優先する
    const deposit = depositManual ?? depositCsv;

    const salesCsv =
      daySale && daySale.source === "csv" ? daySale.cash_amount : null;
    const salesCsvManualRow =
      daySale && daySale.source === "manual" ? daySale.cash_amount : null;
    const reportManualSales = report?.manual_sales ?? null;
    const salesManual = reportManualSales ?? salesCsvManualRow;
    const salesEff = salesManual ?? salesCsv;
    const salesCard = daySale ? daySale.card_amount : null;

    const diff =
      deposit !== null && salesEff !== null ? deposit - salesEff : null;

    // データ元バッジ
    const depositSource: "csv" | "manual" | null =
      depositManual !== null ? "manual" : depositCsv !== null ? "csv" : null;
    const salesSource: "csv" | "manual" | null =
      salesManual !== null ? "manual" : salesCsv !== null ? "csv" : null;
    const depositOverride = depositManual !== null && depositCsv !== null;
    const salesOverride = salesManual !== null && salesCsv !== null;

    let source: DataSourceBadge = null;
    if (depositSource !== null || salesSource !== null) {
      if (depositOverride || salesOverride) {
        source = "混在";
      } else if (depositSource === null || salesSource === null) {
        source = "一部CSV";
      } else if (depositSource === "csv" && salesSource === "csv") {
        source = "CSV";
      } else if (depositSource === "manual" && salesSource === "manual") {
        source = "手動";
      } else {
        source = "混在";
      }
    }

    const hasData = depositSource !== null || salesSource !== null;
    let status: ReviewStatus | null = null;
    let auto = false;
    if (review) {
      status = review.status as ReviewStatus;
      auto = review.auto === 1;
    } else if (hasData) {
      if (diff === 0) {
        status = "confirmed";
        auto = true;
      } else {
        status = "unconfirmed";
      }
    }

    rows.push({
      date,
      day,
      deposit,
      depositCsv,
      depositManual,
      sales: salesEff,
      salesCsv,
      salesCard,
      salesManual,
      diff,
      source,
      // "[]" は2文字なので、それより長ければ写真あり
      hasPhotos: (report?.photos_len ?? 0) > 2,
      hasComment: !!report?.comment,
      report: report
        ? {
            comment: report.comment,
            manualDeposit: report.manual_deposit,
            manualSales: report.manual_sales,
          }
        : null,
      status,
      auto,
      memo: review?.memo ?? null,
    });
  }

  const totals = {
    deposit: rows.reduce((s, r) => s + (r.deposit ?? 0), 0),
    sales: rows.reduce((s, r) => s + (r.sales ?? 0), 0),
    diff: rows.reduce((s, r) => s + (r.diff ?? 0), 0),
  };
  const unconfirmed = rows.filter((r) => r.status === "unconfirmed");
  return {
    store,
    month,
    rows,
    totals,
    unconfirmedCount: unconfirmed.length,
    unconfirmedDiffTotal: unconfirmed.reduce(
      (s, r) => s + Math.abs(r.diff ?? 0),
      0
    ),
  };
}

export async function buildMonthGrid(
  db: DB,
  store: Store,
  month: string
): Promise<MonthGrid> {
  const data = await loadReconData(db, [store.id], `${month}-01`, `${month}-31`);
  return computeMonthGrid(store, month, data);
}

export type DashboardData = {
  lastImports: { mf: string | null; pos: string | null };
  diffRows: Array<{
    storeId: string;
    storeName: string;
    date: string;
    diff: number;
    month: string;
  }>;
  missingCsvDays: { mf: number; pos: number };
  noDepositStores: Array<{
    storeId: string;
    storeName: string;
    streak: number;
    lastDate: string | null;
    month: string;
  }>;
};

export async function buildDashboard(db: DB): Promise<DashboardData> {
  const stores = await db.all<Store>(
    `SELECT * FROM stores WHERE active = 1 ORDER BY code`
  );
  const storeIds = stores.map((s) => s.id);
  const today = todayStringLocal();

  const last7: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
  }

  const marks = storeIds.map(() => "?").join(",") || "NULL";
  // 互いに依存しない問い合わせはまとめて投げる
  const [lastImports, monthRows, lastDeposits, mfDates, posDates] =
    await Promise.all([
      db.all<{ kind: string; ts: string | null }>(
        `SELECT kind, MAX(imported_at) AS ts FROM csv_imports WHERE status = 'completed' GROUP BY kind`
      ),
      db.all<{ store_id: string; m: string }>(
        `SELECT DISTINCT store_id, SUBSTR(date, 1, 7) AS m FROM (
           SELECT store_id, date FROM mf_deposits WHERE store_id IN (${marks})
           UNION ALL SELECT store_id, date FROM pos_sales WHERE store_id IN (${marks})
           UNION ALL SELECT store_id, date FROM daily_reports WHERE store_id IN (${marks})
         ) AS d ORDER BY m DESC`,
        [...storeIds, ...storeIds, ...storeIds]
      ),
      db.all<{ store_id: string; date: string }>(
        `SELECT store_id, MAX(date) AS date FROM mf_deposits GROUP BY store_id`
      ),
      db.all<{ date: string }>(
        `SELECT DISTINCT date FROM mf_deposits WHERE source = 'csv' AND date >= ?`,
        [last7[6]]
      ),
      db.all<{ date: string }>(
        `SELECT DISTINCT date FROM pos_sales WHERE source = 'csv' AND date >= ?`,
        [last7[6]]
      ),
    ]);

  // 店舗ごとにデータのある直近6か月を対象にする
  const monthsByStore = new Map<string, string[]>();
  for (const { store_id, m } of monthRows) {
    const list = monthsByStore.get(store_id) ?? [];
    if (list.length < 6) list.push(m);
    monthsByStore.set(store_id, list);
  }
  const allMonths = Array.from(monthsByStore.values()).flat();

  const diffRows: DashboardData["diffRows"] = [];
  if (allMonths.length > 0) {
    const minMonth = allMonths.reduce((a, b) => (a < b ? a : b));
    const maxMonth = allMonths.reduce((a, b) => (a > b ? a : b));
    const data = await loadReconData(
      db,
      storeIds,
      `${minMonth}-01`,
      `${maxMonth}-31`
    );
    for (const store of stores) {
      for (const m of monthsByStore.get(store.id) ?? []) {
        const grid = computeMonthGrid(store, m, data);
        for (const row of grid.rows) {
          if (row.status === "unconfirmed" && row.diff !== null && row.diff !== 0) {
            diffRows.push({
              storeId: store.id,
              storeName: store.name,
              date: row.date,
              diff: row.diff,
              month: m,
            });
          }
        }
      }
    }
  }
  diffRows.sort((a, b) => b.date.localeCompare(a.date));
  diffRows.splice(50);

  const mfSet = new Set(mfDates.map((r) => r.date));
  const posSet = new Set(posDates.map((r) => r.date));
  const missingCsvDays = {
    mf: last7.filter((d) => !mfSet.has(d)).length,
    pos: last7.filter((d) => !posSet.has(d)).length,
  };

  // 4日連続入金なし
  const lastDepositByStore = new Map(
    lastDeposits.map((r) => [r.store_id, r.date])
  );
  const noDepositStores: DashboardData["noDepositStores"] = [];
  for (const store of stores) {
    const lastDate = lastDepositByStore.get(store.id) ?? null;
    const since = lastDate ?? store.created_at.slice(0, 10);
    const streak = Math.max(
      0,
      Math.round(
        (new Date(today + "T00:00:00").getTime() -
          new Date(since + "T00:00:00").getTime()) /
          86400000
      )
    );
    if (streak >= 4) {
      noDepositStores.push({
        storeId: store.id,
        storeName: store.name,
        streak,
        lastDate,
        month: (lastDate ?? today).slice(0, 7),
      });
    }
  }
  noDepositStores.sort((a, b) => b.streak - a.streak);

  return {
    lastImports: {
      mf: lastImports.find((r) => r.kind === "mf")?.ts ?? null,
      pos: lastImports.find((r) => r.kind === "pos")?.ts ?? null,
    },
    diffRows,
    missingCsvDays,
    noDepositStores,
  };
}
