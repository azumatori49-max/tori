/**
 * 運営（サービス提供者）向け機能。
 *
 * 請求書払いの運用フロー:
 *   1. お客様が新規登録して会社を作成 → 承認待ち（active: false）
 *   2. 運営が内容を確認し、請求書を送付
 *   3. 運営管理画面で「利用開始を承認」→ active: true で利用開始
 *   4. 未払い等があれば「停止」→ active: false（データは保持）
 *
 * 運営者はメールアドレスで判定する。追加する場合はこの配列と
 * firebase/firestore.rules 内の同じリストの両方に追記すること。
 */
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';

import { fbDb } from '@/lib/firebase';

/** 運営者のメールアドレス（rules側と揃えること） */
export const OPERATOR_EMAILS = ['azumatori49@gmail.com'];

/** このユーザーが運営者か */
export function isOperatorUser(user: User | null): boolean {
  const email = user?.email?.toLowerCase() ?? '';
  return OPERATOR_EMAILS.includes(email);
}

export interface OperatorOrgRow {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date | null;
}

/** 全組織（申し込み）の一覧を取得（運営者のみルールで許可） */
export async function fetchAllOrgs(): Promise<OperatorOrgRow[]> {
  if (!fbDb) return [];
  const snap = await getDocs(collection(fbDb, 'orgs'));
  const rows = snap.docs.map((d) => {
    const data = d.data() as {
      name: string;
      active?: boolean;
      createdAt?: { toDate: () => Date } | null;
    };
    return {
      id: d.id,
      name: data.name,
      // 過去に作られた組織（activeフィールドなし）は有効扱い
      active: data.active !== false,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
    };
  });
  // 新しい申し込みが上に来るように
  return rows.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** 組織の利用開始/停止を切り替える（運営者のみルールで許可） */
export async function setOrgActive(orgId: string, active: boolean): Promise<void> {
  if (!fbDb) return;
  await updateDoc(doc(fbDb, 'orgs', orgId), { active });
}
