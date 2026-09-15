import type { DB } from "./db";
import { hashPassword } from "./password";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  newId,
  nowString,
} from "./config";

// TEXT主キー + TEXT/INTEGER のみを使い、SQLite/PostgreSQL共通のDDLにする
const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    store_id TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    last_login_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    area TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS store_csv_codes (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    code TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    UNIQUE (kind, code)
  )`,
  `CREATE TABLE IF NOT EXISTS csv_imports (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    file_name TEXT NOT NULL,
    imported_by TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    matched INTEGER NOT NULL DEFAULT 0,
    dup_skipped INTEGER NOT NULL DEFAULT 0,
    unmatched INTEGER NOT NULL DEFAULT 0,
    excluded INTEGER NOT NULL DEFAULT 0,
    overwritten INTEGER NOT NULL DEFAULT 0,
    mapping_json TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS mf_deposits (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    source TEXT NOT NULL,
    import_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS pos_sales (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL,
    cash_amount INTEGER NOT NULL,
    card_amount INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    import_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL,
    manual_deposit INTEGER,
    manual_sales INTEGER,
    comment TEXT,
    photos_json TEXT NOT NULL DEFAULT '[]',
    created_by TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE (store_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    memo TEXT,
    auto INTEGER NOT NULL DEFAULT 0,
    updated_by TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE (store_id, date)
  )`,
];

function receiptSvg(title: string, lines: [string, string][]): string {
  const rows = lines
    .map(
      ([label, value], i) =>
        `<text x="24" y="${96 + i * 26}" font-size="14" fill="#333">${label}</text>` +
        `<text x="216" y="${96 + i * 26}" font-size="14" fill="#333" text-anchor="end">${value}</text>`
    )
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320">` +
    `<rect width="240" height="320" fill="#fffef8" stroke="#ccc"/>` +
    `<text x="120" y="40" font-size="16" font-weight="bold" text-anchor="middle" fill="#111">${title}</text>` +
    `<line x1="20" y1="56" x2="220" y2="56" stroke="#999" stroke-dasharray="4 3"/>` +
    rows +
    `<line x1="20" y1="270" x2="220" y2="270" stroke="#999" stroke-dasharray="4 3"/>` +
    `<text x="120" y="296" font-size="12" text-anchor="middle" fill="#777">デモ用サンプル画像</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function seed(db: DB): Promise<void> {
  const now = nowString();

  // 管理者(本部) — 環境変数で上書き可能
  const adminId = newId();
  await db.run(
    `INSERT INTO users (id, name, email, password_hash, role, store_id, active, must_change_password, created_at)
     VALUES (?, ?, ?, ?, 'hq', NULL, 1, 0, ?)`,
    [adminId, "管理者", DEFAULT_ADMIN_EMAIL, hashPassword(DEFAULT_ADMIN_PASSWORD), now]
  );

  // デモ店舗
  const stores: Array<[string, string, string]> = [
    ["ST001", "八丁堀デモ店", "東京"],
    ["ST002", "津田沼デモ店", "千葉"],
    ["ST003", "新宿デモ店", "東京"],
    ["ST004", "渋谷デモ店", "東京"],
  ];
  const storeIds: Record<string, string> = {};
  for (const [code, name, area] of stores) {
    const id = newId();
    storeIds[code] = id;
    await db.run(
      `INSERT INTO stores (id, code, name, area, active, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
      [id, code, name, area, now]
    );
  }

  // CSVコード（主コード + 副コード）
  const codes: Array<[string, "mf" | "pos", string, number]> = [
    ["ST001", "mf", "MF-MAIN-ST001", 1],
    ["ST001", "mf", "MF-ST001", 0],
    ["ST001", "pos", "POS-MAIN-ST001", 1],
    ["ST001", "pos", "POS-ST001", 0],
    ["ST002", "mf", "MF-ST002", 1],
    ["ST002", "pos", "POS-ST002", 1],
    ["ST004", "mf", "MF-ST004", 1],
    ["ST004", "pos", "POS-ST004", 1],
  ];
  for (const [storeCode, kind, code, primary] of codes) {
    await db.run(
      `INSERT INTO store_csv_codes (id, store_id, kind, code, is_primary) VALUES (?, ?, ?, ?, ?)`,
      [newId(), storeIds[storeCode], kind, code, primary]
    );
  }

  // デモユーザー
  const demoUsers: Array<[string, string, "hq" | "store_staff", string | null, number]> = [
    ["デモ本部担当者", "hq@example.test", "hq", null, 0],
    ["デモ店舗スタッフ", "store-st001@example.test", "store_staff", storeIds["ST001"], 0],
    ["初回変更デモスタッフ", "first-login@example.test", "store_staff", storeIds["ST001"], 1],
  ];
  for (const [name, email, role, storeId, mustChange] of demoUsers) {
    await db.run(
      `INSERT INTO users (id, name, email, password_hash, role, store_id, active, must_change_password, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [newId(), name, email, hashPassword("demo1234"), role, storeId, mustChange, now]
    );
  }

  // デモ照合データ（2026年4月 八丁堀デモ店 — マニュアルのスクリーンショット相当）
  const st1 = storeIds["ST001"];
  const dep = async (date: string, amount: number, source = "csv") =>
    db.run(
      `INSERT INTO mf_deposits (id, store_id, date, amount, source, import_id) VALUES (?, ?, ?, ?, ?, NULL)`,
      [newId(), st1, date, amount, source]
    );
  const pos = async (date: string, cash: number, card: number, source = "csv") =>
    db.run(
      `INSERT INTO pos_sales (id, store_id, date, cash_amount, card_amount, source, import_id) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [newId(), st1, date, cash, card, source]
    );

  await dep("2026-04-01", 100000);
  await pos("2026-04-01", 100000, 30000);
  await dep("2026-04-02", 95000);
  await pos("2026-04-02", 100000, 20000);
  await dep("2026-04-03", 98000);
  await pos("2026-04-03", 100000, 25000);
  await pos("2026-04-04", 120000, 40000);
  await dep("2026-04-05", 100000);
  await pos("2026-04-05", 100000, 35000, "manual");

  // 他店舗の最終入金（ダッシュボードの「連続入金なし」デモ用）
  const others: Array<[string, string, number]> = [
    ["ST002", "2026-04-03", 80000],
    ["ST003", "2026-04-05", 60000],
    ["ST004", "2026-04-06", 70000],
  ];
  for (const [code, date, amount] of others) {
    await db.run(
      `INSERT INTO mf_deposits (id, store_id, date, amount, source, import_id) VALUES (?, ?, ?, ?, 'csv', NULL)`,
      [newId(), storeIds[code], date, amount]
    );
  }

  // 店舗報告（写真・コメント・手動金額）
  const photo1 = receiptSvg("入金明細レシート", [
    ["日付", "2026/04/03"],
    ["店舗", "八丁堀デモ店"],
    ["入金額", "¥98,000"],
    ["担当", "デモ店舗スタッフ"],
  ]);
  const photo2 = receiptSvg("POSレジ 精算票", [
    ["日付", "2026/04/03"],
    ["現金売上", "¥100,000"],
    ["カード売上", "¥25,000"],
    ["釣銭準備金", "¥30,000"],
  ]);
  await db.run(
    `INSERT INTO daily_reports (id, store_id, date, manual_deposit, manual_sales, comment, photos_json, created_by, updated_at)
     VALUES (?, ?, '2026-04-03', NULL, NULL, ?, ?, NULL, ?)`,
    [newId(), st1, "レシート控えを添付します。", JSON.stringify([photo1, photo2]), now]
  );
  await db.run(
    `INSERT INTO daily_reports (id, store_id, date, manual_deposit, manual_sales, comment, photos_json, created_by, updated_at)
     VALUES (?, ?, '2026-04-02', NULL, NULL, ?, '[]', NULL, ?)`,
    [newId(), st1, "本日分の入金は明朝になります。", now]
  );
  await db.run(
    `INSERT INTO daily_reports (id, store_id, date, manual_deposit, manual_sales, comment, photos_json, created_by, updated_at)
     VALUES (?, ?, '2026-04-05', 100000, 100000, ?, '[]', NULL, ?)`,
    [newId(), st1, "レジ締め後に手動入力しました。", now]
  );

  // レビュー（確認中の例）
  await db.run(
    `INSERT INTO reviews (id, store_id, date, status, memo, auto, updated_by, updated_at)
     VALUES (?, ?, '2026-04-03', 'checking', ?, 0, ?, ?)`,
    [newId(), st1, "ダミー写真とコメントを確認中です。", adminId, now]
  );
  await db.run(
    `INSERT INTO reviews (id, store_id, date, status, memo, auto, updated_by, updated_at)
     VALUES (?, ?, '2026-04-05', 'confirmed', NULL, 0, ?, ?)`,
    [newId(), st1, adminId, now]
  );
}

export async function initSchema(db: DB): Promise<void> {
  // サーバーレスでは起動のたびに呼ばれるので、テーブルが揃っていれば1クエリで済ませる
  let userCount: number | null = null;
  try {
    // 最初と最後に作るテーブルを両方参照し、どちらかが無ければエラーにしてDDLへ進む
    const row = await db.get<{ count: number | string }>(
      "SELECT (SELECT COUNT(*) FROM users) AS count, (SELECT COUNT(*) FROM reviews) AS r"
    );
    userCount = Number(row?.count ?? 0);
  } catch {
    userCount = null;
  }

  if (userCount === null) {
    for (const ddl of TABLES) {
      await db.run(ddl);
    }
    const row = await db.get<{ count: number | string }>(
      "SELECT COUNT(*) AS count FROM users"
    );
    userCount = Number(row?.count ?? 0);
  }

  if (userCount === 0) {
    await seed(db);
  }
}
