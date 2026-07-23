"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { findAdminByEmail, getDb } from "./db";
import { verifyPassword } from "./password";
import { createSessionCookie, destroySession, getSession } from "./session";

function requireSession() {
  const session = getSession();
  if (!session) redirect("/login");
  return session;
}

export async function login(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const admin = findAdminByEmail(email);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return { error: "メールアドレスまたはパスワードが正しくありません" };
  }

  createSessionCookie(admin.email, admin.name);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  destroySession();
  redirect("/login");
}

export async function addMember(formData: FormData): Promise<void> {
  requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  getDb()
    .prepare(
      "INSERT INTO members (name, email, phone, monthly_fee, note) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      name,
      String(formData.get("email") ?? "").trim() || null,
      String(formData.get("phone") ?? "").trim() || null,
      Number(formData.get("monthly_fee") ?? 0) || 0,
      String(formData.get("note") ?? "").trim() || null
    );
  revalidatePath("/members");
}

export async function updateMember(formData: FormData): Promise<void> {
  requireSession();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  getDb()
    .prepare(
      `UPDATE members
       SET name = ?, email = ?, phone = ?, monthly_fee = ?, note = ?, active = ?
       WHERE id = ?`
    )
    .run(
      name,
      String(formData.get("email") ?? "").trim() || null,
      String(formData.get("phone") ?? "").trim() || null,
      Number(formData.get("monthly_fee") ?? 0) || 0,
      String(formData.get("note") ?? "").trim() || null,
      formData.get("active") === "on" ? 1 : 0,
      id
    );
  revalidatePath("/members");
  redirect("/members");
}

export async function deleteMember(formData: FormData): Promise<void> {
  requireSession();
  const id = Number(formData.get("id"));
  if (!id) return;

  getDb().prepare("DELETE FROM members WHERE id = ?").run(id);
  revalidatePath("/members");
}

export async function togglePayment(formData: FormData): Promise<void> {
  requireSession();
  const memberId = Number(formData.get("member_id"));
  const month = String(formData.get("month") ?? "");
  if (!memberId || !/^\d{4}-\d{2}$/.test(month)) return;

  const db = getDb();
  const existing = db
    .prepare("SELECT id, status FROM payments WHERE member_id = ? AND month = ?")
    .get(memberId, month) as { id: number; status: string } | undefined;

  if (existing) {
    if (existing.status === "paid") {
      db.prepare(
        "UPDATE payments SET status = 'unpaid', paid_at = NULL WHERE id = ?"
      ).run(existing.id);
    } else {
      db.prepare(
        "UPDATE payments SET status = 'paid', paid_at = datetime('now', 'localtime') WHERE id = ?"
      ).run(existing.id);
    }
  } else {
    const member = db
      .prepare("SELECT monthly_fee FROM members WHERE id = ?")
      .get(memberId) as { monthly_fee: number } | undefined;
    db.prepare(
      `INSERT INTO payments (member_id, month, amount, status, paid_at)
       VALUES (?, ?, ?, 'paid', datetime('now', 'localtime'))`
    ).run(memberId, month, member?.monthly_fee ?? 0);
  }

  revalidatePath("/payments");
  revalidatePath("/dashboard");
}

export async function updatePaymentDetail(formData: FormData): Promise<void> {
  requireSession();
  const memberId = Number(formData.get("member_id"));
  const month = String(formData.get("month") ?? "");
  if (!memberId || !/^\d{4}-\d{2}$/.test(month)) return;

  const amount = Number(formData.get("amount") ?? 0) || 0;
  const note = String(formData.get("note") ?? "").trim() || null;

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM payments WHERE member_id = ? AND month = ?")
    .get(memberId, month) as { id: number } | undefined;

  if (existing) {
    db.prepare("UPDATE payments SET amount = ?, note = ? WHERE id = ?").run(
      amount,
      note,
      existing.id
    );
  } else {
    db.prepare(
      "INSERT INTO payments (member_id, month, amount, status, note) VALUES (?, ?, ?, 'unpaid', ?)"
    ).run(memberId, month, amount, note);
  }

  revalidatePath("/payments");
  revalidatePath("/dashboard");
}
