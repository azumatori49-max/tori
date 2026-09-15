import type { DB } from "./db";
import type {
  DailyReport,
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
    photos: string[];
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

export async function buildMonthGrid(
  db: DB,
  store: Store,
  month: string
): Promise<MonthGrid> {
  const from = `${month}-01`;
  const to = `${month}-31`;

  const deposits = await db.all<MfDeposit>(
    `SELECT * FROM mf_deposits WHERE store_id = ? AND date >= ? AND date <= ?`,
    [store.id, from, to]
  );
  const sales = await db.all<PosSale>(
    `SELECT * FROM pos_sales WHERE store_id = ? AND date >= ? AND date <= ?`,
    [store.id, from, to]
  );
  const reports = await db.all<DailyReport>(
    `SELECT * FROM daily_reports WHERE store_id = ? AND date >= ? AND date <= ?`,
    [store.id, from, to]
  );
  const reviews = await db.all<Review>(
    `SELECT * FROM reviews WHERE store_id = ? AND date >= ? AND date <= ?`,
    [store.id, from, to]
  );

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
      depositManual !== null && depositCsv !== null
        ? "manual"
        : depositManual !== null
          ? "manual"
          : depositCsv !== null
            ? "csv"
            : null;
    const salesSource: "csv" | "manual" | null =
      salesManual !== null && salesCsv !== null
        ? "manual"
        : salesManual !== null
          ? "manual"
          : salesCsv !== null
            ? "csv"
            : null;
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

    const photos: string[] = report ? JSON.parse(report.photos_json || "[]") : [];
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
      hasPhotos: photos.length > 0,
      hasComment: !!report?.comment,
      report: report
        ? {
            comment: report.comment,
            photos,
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
  const today = todayStringLocal();

  const lastMf = await db.get<{ ts: string }>(
    `SELECT MAX(imported_at) AS ts FROM csv_imports WHERE kind = 'mf' AND status = 'completed'`
  );
  const lastPos = await db.get<{ ts: string }>(
    `SELECT MAX(imported_at) AS ts FROM csv_imports WHERE kind = 'pos' AND status = 'completed'`
  );

  // 未確認差額（月を限定せず、データのある直近6か月分を対象にする）
  const diffRows: DashboardData["diffRows"] = [];
  for (const store of stores) {
    const monthRows = await db.all<{ m: string }>(
      `SELECT DISTINCT SUBSTR(date, 1, 7) AS m FROM (
         SELECT date FROM mf_deposits WHERE store_id = ?
         UNION ALL SELECT date FROM pos_sales WHERE store_id = ?
         UNION ALL SELECT date FROM daily_reports WHERE store_id = ?
       ) AS d ORDER BY m DESC LIMIT 6`,
      [store.id, store.id, store.id]
    );
    for (const { m } of monthRows) {
      const grid = await buildMonthGrid(db, store, m);
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

  diffRows.sort((a, b) => b.date.localeCompare(a.date));
  diffRows.splice(50);

  // 直近7日でCSV取込データが存在しない日数
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
  const mfDates = await db.all<{ date: string }>(
    `SELECT DISTINCT date FROM mf_deposits WHERE source = 'csv' AND date >= ?`,
    [last7[6]]
  );
  const posDates = await db.all<{ date: string }>(
    `SELECT DISTINCT date FROM pos_sales WHERE source = 'csv' AND date >= ?`,
    [last7[6]]
  );
  const mfSet = new Set(mfDates.map((r) => r.date));
  const posSet = new Set(posDates.map((r) => r.date));
  const missingCsvDays = {
    mf: last7.filter((d) => !mfSet.has(d)).length,
    pos: last7.filter((d) => !posSet.has(d)).length,
  };

  // 4日連続入金なし
  const noDepositStores: DashboardData["noDepositStores"] = [];
  for (const store of stores) {
    const last = await db.get<{ date: string }>(
      `SELECT MAX(date) AS date FROM mf_deposits WHERE store_id = ?`,
      [store.id]
    );
    const lastDate = last?.date ?? null;
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
    lastImports: { mf: lastMf?.ts ?? null, pos: lastPos?.ts ?? null },
    diffRows,
    missingCsvDays,
    noDepositStores,
  };
}
