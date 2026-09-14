export type Role = "hq" | "store_staff";

export type User = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  store_id: string | null;
  active: number;
  must_change_password: number;
  last_login_at: string | null;
  created_at: string;
};

export type Store = {
  id: string;
  code: string;
  name: string;
  area: string | null;
  active: number;
  created_at: string;
};

export type StoreCsvCode = {
  id: string;
  store_id: string;
  kind: "mf" | "pos";
  code: string;
  is_primary: number;
};

export type CsvImport = {
  id: string;
  kind: "mf" | "pos";
  file_name: string;
  imported_by: string;
  imported_at: string;
  mode: "normal" | "overwrite";
  status: "completed" | "rolled_back" | "failed";
  total_rows: number;
  matched: number;
  dup_skipped: number;
  unmatched: number;
  excluded: number;
  overwritten: number;
  mapping_json: string;
};

export type MfDeposit = {
  id: string;
  store_id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  source: "csv" | "manual";
  import_id: string | null;
};

export type PosSale = {
  id: string;
  store_id: string;
  date: string;
  cash_amount: number;
  card_amount: number;
  source: "csv" | "manual";
  import_id: string | null;
};

export type DailyReport = {
  id: string;
  store_id: string;
  date: string;
  manual_deposit: number | null;
  manual_sales: number | null;
  comment: string | null;
  photos_json: string; // JSON array of data URLs
  created_by: string | null;
  updated_at: string;
};

export type Review = {
  id: string;
  store_id: string;
  date: string;
  status: "unconfirmed" | "checking" | "confirmed";
  memo: string | null;
  auto: number;
  updated_by: string | null;
  updated_at: string;
};

export type ReviewStatus = Review["status"];
export type DataSourceBadge = "CSV" | "手動" | "一部CSV" | "混在" | null;
