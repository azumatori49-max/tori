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

export type PaidPayment = Payment & { member_name: string };

export type MemberPaymentRow = Member & {
  payment_id: number | null;
  payment_amount: number | null;
  payment_status: "paid" | "unpaid" | null;
  paid_at: string | null;
  payment_note: string | null;
};

export type MemberInput = {
  name: string;
  email: string | null;
  phone: string | null;
  monthly_fee: number;
  note: string | null;
};
