import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./password";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  nowString,
} from "./config";
import type { Store } from "./store";
import type {
  Admin,
  Member,
  MemberPaymentRow,
  PaidPayment,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "payment-check.db");

export async function createSqliteStore(): Promise<Store> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
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

  return {
    async findAdminByEmail(email) {
      return db.prepare("SELECT * FROM admins WHERE email = ?").get(email) as
        | Admin
        | undefined;
    },

    async listMembers() {
      return db.prepare("SELECT * FROM members ORDER BY id").all() as Member[];
    },

    async getMember(id) {
      return db.prepare("SELECT * FROM members WHERE id = ?").get(id) as
        | Member
        | undefined;
    },

    async insertMember(input) {
      db.prepare(
        "INSERT INTO members (name, email, phone, monthly_fee, note) VALUES (?, ?, ?, ?, ?)"
      ).run(input.name, input.email, input.phone, input.monthly_fee, input.note);
    },

    async updateMember(id, input) {
      db.prepare(
        `UPDATE members
         SET name = ?, email = ?, phone = ?, monthly_fee = ?, note = ?, active = ?
         WHERE id = ?`
      ).run(
        input.name,
        input.email,
        input.phone,
        input.monthly_fee,
        input.note,
        input.active ? 1 : 0,
        id
      );
    },

    async deleteMember(id) {
      db.prepare("DELETE FROM members WHERE id = ?").run(id);
    },

    async listMemberPayments(month) {
      return db
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
    },

    async recentPaidPayments(limit) {
      return db
        .prepare(
          `SELECT p.*, m.name AS member_name
           FROM payments p
           JOIN members m ON m.id = p.member_id
           WHERE p.status = 'paid'
           ORDER BY p.paid_at DESC
           LIMIT ?`
        )
        .all(limit) as PaidPayment[];
    },

    async togglePayment(memberId, month) {
      const existing = db
        .prepare(
          "SELECT id, status FROM payments WHERE member_id = ? AND month = ?"
        )
        .get(memberId, month) as { id: number; status: string } | undefined;

      if (existing) {
        if (existing.status === "paid") {
          db.prepare(
            "UPDATE payments SET status = 'unpaid', paid_at = NULL WHERE id = ?"
          ).run(existing.id);
        } else {
          db.prepare(
            "UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?"
          ).run(nowString(), existing.id);
        }
      } else {
        const member = db
          .prepare("SELECT monthly_fee FROM members WHERE id = ?")
          .get(memberId) as { monthly_fee: number } | undefined;
        db.prepare(
          `INSERT INTO payments (member_id, month, amount, status, paid_at)
           VALUES (?, ?, ?, 'paid', ?)`
        ).run(memberId, month, member?.monthly_fee ?? 0, nowString());
      }
    },

    async upsertPaymentDetail(memberId, month, amount, note) {
      db.prepare(
        `INSERT INTO payments (member_id, month, amount, status, note)
         VALUES (?, ?, ?, 'unpaid', ?)
         ON CONFLICT (member_id, month)
         DO UPDATE SET amount = excluded.amount, note = excluded.note`
      ).run(memberId, month, amount, note);
    },
  };
}
