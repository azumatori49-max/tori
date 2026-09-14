import postgres from "postgres";
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

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '管理者',
  created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  monthly_fee INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  paid_at TEXT,
  note TEXT,
  UNIQUE (member_id, month)
);
`;

export async function createPostgresStore(url: string): Promise<Store> {
  // prepare: false でpgbouncer(トランザクションプーリング)互換にする
  const sql = postgres(url, { prepare: false, onnotice: () => {} });

  await sql.unsafe(SCHEMA);

  const [{ count }] = await sql<
    { count: number }[]
  >`SELECT COUNT(*)::int AS count FROM admins`;
  if (count === 0) {
    await sql`
      INSERT INTO admins (email, password_hash, name)
      VALUES (${DEFAULT_ADMIN_EMAIL}, ${hashPassword(DEFAULT_ADMIN_PASSWORD)}, ${"管理者"})
      ON CONFLICT (email) DO NOTHING`;
  }

  return {
    async findAdminByEmail(email) {
      const rows = await sql<Admin[]>`
        SELECT * FROM admins WHERE email = ${email}`;
      return rows[0];
    },

    async listMembers() {
      return await sql<Member[]>`SELECT * FROM members ORDER BY id`;
    },

    async getMember(id) {
      const rows = await sql<Member[]>`SELECT * FROM members WHERE id = ${id}`;
      return rows[0];
    },

    async insertMember(input) {
      await sql`
        INSERT INTO members (name, email, phone, monthly_fee, note)
        VALUES (${input.name}, ${input.email}, ${input.phone}, ${input.monthly_fee}, ${input.note})`;
    },

    async updateMember(id, input) {
      await sql`
        UPDATE members
        SET name = ${input.name},
            email = ${input.email},
            phone = ${input.phone},
            monthly_fee = ${input.monthly_fee},
            note = ${input.note},
            active = ${input.active ? 1 : 0}
        WHERE id = ${id}`;
    },

    async deleteMember(id) {
      await sql`DELETE FROM members WHERE id = ${id}`;
    },

    async listMemberPayments(month) {
      return await sql<MemberPaymentRow[]>`
        SELECT m.*,
               p.id AS payment_id,
               p.amount AS payment_amount,
               p.status AS payment_status,
               p.paid_at,
               p.note AS payment_note
        FROM members m
        LEFT JOIN payments p ON p.member_id = m.id AND p.month = ${month}
        WHERE m.active = 1
        ORDER BY m.id`;
    },

    async recentPaidPayments(limit) {
      return await sql<PaidPayment[]>`
        SELECT p.*, m.name AS member_name
        FROM payments p
        JOIN members m ON m.id = p.member_id
        WHERE p.status = 'paid'
        ORDER BY p.paid_at DESC NULLS LAST
        LIMIT ${limit}`;
    },

    async togglePayment(memberId, month) {
      const existing = await sql<{ id: number; status: string }[]>`
        SELECT id, status FROM payments
        WHERE member_id = ${memberId} AND month = ${month}`;

      if (existing[0]) {
        if (existing[0].status === "paid") {
          await sql`
            UPDATE payments SET status = 'unpaid', paid_at = NULL
            WHERE id = ${existing[0].id}`;
        } else {
          await sql`
            UPDATE payments SET status = 'paid', paid_at = ${nowString()}
            WHERE id = ${existing[0].id}`;
        }
      } else {
        const member = await sql<{ monthly_fee: number }[]>`
          SELECT monthly_fee FROM members WHERE id = ${memberId}`;
        await sql`
          INSERT INTO payments (member_id, month, amount, status, paid_at)
          VALUES (${memberId}, ${month}, ${member[0]?.monthly_fee ?? 0}, 'paid', ${nowString()})`;
      }
    },

    async upsertPaymentDetail(memberId, month, amount, note) {
      await sql`
        INSERT INTO payments (member_id, month, amount, status, note)
        VALUES (${memberId}, ${month}, ${amount}, 'unpaid', ${note})
        ON CONFLICT (member_id, month)
        DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note`;
    },
  };
}
