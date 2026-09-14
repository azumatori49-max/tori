"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "./store";
import { verifyPassword } from "./password";
import { createSessionCookie, destroySession, getSession } from "./session";
import type { MemberInput } from "./types";

function requireSession() {
  const session = getSession();
  if (!session) redirect("/login");
  return session;
}

function memberInputFromForm(formData: FormData): MemberInput | null {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return null;
  return {
    name,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    monthly_fee: Number(formData.get("monthly_fee") ?? 0) || 0,
    note: String(formData.get("note") ?? "").trim() || null,
  };
}

export async function login(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const store = await getStore();
  const admin = await store.findAdminByEmail(email);
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
  const input = memberInputFromForm(formData);
  if (!input) return;

  await (await getStore()).insertMember(input);
  revalidatePath("/members");
}

export async function updateMember(formData: FormData): Promise<void> {
  requireSession();
  const id = Number(formData.get("id"));
  const input = memberInputFromForm(formData);
  if (!id || !input) return;

  await (await getStore()).updateMember(id, {
    ...input,
    active: formData.get("active") === "on",
  });
  revalidatePath("/members");
  redirect("/members");
}

export async function deleteMember(formData: FormData): Promise<void> {
  requireSession();
  const id = Number(formData.get("id"));
  if (!id) return;

  await (await getStore()).deleteMember(id);
  revalidatePath("/members");
}

export async function togglePayment(formData: FormData): Promise<void> {
  requireSession();
  const memberId = Number(formData.get("member_id"));
  const month = String(formData.get("month") ?? "");
  if (!memberId || !/^\d{4}-\d{2}$/.test(month)) return;

  await (await getStore()).togglePayment(memberId, month);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
}

export async function updatePaymentDetail(formData: FormData): Promise<void> {
  requireSession();
  const memberId = Number(formData.get("member_id"));
  const month = String(formData.get("month") ?? "");
  if (!memberId || !/^\d{4}-\d{2}$/.test(month)) return;

  await (await getStore()).upsertPaymentDetail(
    memberId,
    month,
    Number(formData.get("amount") ?? 0) || 0,
    String(formData.get("note") ?? "").trim() || null
  );
  revalidatePath("/payments");
  revalidatePath("/dashboard");
}
