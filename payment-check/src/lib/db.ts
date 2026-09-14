import { getStore } from "./store";
import type { Member, MemberPaymentRow, PaidPayment } from "./types";

export * from "./types";

export async function listMembers(): Promise<Member[]> {
  return (await getStore()).listMembers();
}

export async function getMember(id: number): Promise<Member | undefined> {
  return (await getStore()).getMember(id);
}

export async function listMemberPayments(
  month: string
): Promise<MemberPaymentRow[]> {
  return (await getStore()).listMemberPayments(month);
}

export async function recentPaidPayments(
  limit: number
): Promise<PaidPayment[]> {
  return (await getStore()).recentPaidPayments(limit);
}

export async function monthSummary(month: string): Promise<{
  total: number;
  paid: number;
  unpaid: number;
  paidAmount: number;
}> {
  const rows = await listMemberPayments(month);
  const paidRows = rows.filter((r) => r.payment_status === "paid");
  return {
    total: rows.length,
    paid: paidRows.length,
    unpaid: rows.length - paidRows.length,
    paidAmount: paidRows.reduce((sum, r) => sum + (r.payment_amount ?? 0), 0),
  };
}
