import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./password";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "payment-check.db");

const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@toriyaro.com";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "toriyaro@1234";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '管理者',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      monthly_fee INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
      paid_at TEXT,
      note TEXT,
      UNIQUE (member_id, month)
    );
  `);

  const adminCount = db
    .prepare("SELECT COUNT(*) AS count FROM admins")
    .get() as { count: number };
  if (adminCount.count === 0) {
    db.prepare(
      "INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)"
    ).run(DEFAULT_ADMIN_EMAIL, hashPassword(DEFAULT_ADMIN_PASSWORD), "管理者");
  }

  return db;
}

export type Admin = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
};

export type Member = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  monthly_fee: number;
  note: string | null;
  active: number;
  created_at: string;
};

export type Payment = {
  id: number;
  member_id: number;
  month: string;
  amount: number;
  status: "paid" | "unpaid";
  paid_at: string | null;
  note: string | null;
};

export type MemberPaymentRow = Member & {
  payment_id: number | null;
  payment_amount: number | null;
  payment_status: "paid" | "unpaid" | null;
  paid_at: string | null;
  payment_note: string | null;
};

export function findAdminByEmail(email: string): Admin | undefined {
  return getDb()
    .prepare("SELECT * FROM admins WHERE email = ?")
    .get(email) as Admin | undefined;
}

export function listMembers(): Member[] {
  return getDb()
    .prepare("SELECT * FROM members ORDER BY id")
    .all() as Member[];
}

export function getMember(id: number): Member | undefined {
  return getDb()
    .prepare("SELECT * FROM members WHERE id = ?")
    .get(id) as Member | undefined;
}

export function listMemberPayments(month: string): MemberPaymentRow[] {
  return getDb()
    .prepare(
      `SELECT m.*,
              p.id AS payment_id,
              p.amount AS payment_amount,
              p.status AS payment_status,
              p.paid_at,
              p.note AS payment_note
       FROM members m
       LEFT JOIN payments p ON p.member_id = m.id AND p.month = ?
       WHERE m.active = 1
       ORDER BY m.id`
    )
    .all(month) as MemberPaymentRow[];
}

export function monthSummary(month: string): {
  total: number;
  paid: number;
  unpaid: number;
  paidAmount: number;
} {
  const rows = listMemberPayments(month);
  const paidRows = rows.filter((r) => r.payment_status === "paid");
  return {
    total: rows.length,
    paid: paidRows.length,
    unpaid: rows.length - paidRows.length,
    paidAmount: paidRows.reduce((sum, r) => sum + (r.payment_amount ?? 0), 0),
  };
}

export function recentPaidPayments(limit: number): Array<
  Payment & { member_name: string }
> {
  return getDb()
    .prepare(
      `SELECT p.*, m.name AS member_name
       FROM payments p
       JOIN members m ON m.id = p.member_id
       WHERE p.status = 'paid'
       ORDER BY p.paid_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<Payment & { member_name: string }>;
}
