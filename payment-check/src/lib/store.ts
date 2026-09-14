import type {
  Admin,
  Member,
  MemberInput,
  MemberPaymentRow,
  PaidPayment,
} from "./types";

export interface Store {
  findAdminByEmail(email: string): Promise<Admin | undefined>;

  listMembers(): Promise<Member[]>;
  getMember(id: number): Promise<Member | undefined>;
  insertMember(input: MemberInput): Promise<void>;
  updateMember(id: number, input: MemberInput & { active: boolean }): Promise<void>;
  deleteMember(id: number): Promise<void>;

  listMemberPayments(month: string): Promise<MemberPaymentRow[]>;
  recentPaidPayments(limit: number): Promise<PaidPayment[]>;
  togglePayment(memberId: number, month: string): Promise<void>;
  upsertPaymentDetail(
    memberId: number,
    month: string,
    amount: number,
    note: string | null
  ): Promise<void>;
}

let storePromise: Promise<Store> | null = null;

// DATABASE_URL(PostgreSQL) があればPostgres、なければローカルのSQLiteを使う
export function getStore(): Promise<Store> {
  if (!storePromise) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    storePromise = url
      ? import("./postgres-store").then((m) => m.createPostgresStore(url))
      : import("./sqlite-store").then((m) => m.createSqliteStore());
  }
  return storePromise;
}
