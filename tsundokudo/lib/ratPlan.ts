/**
 * ネズミ駆除サービスの料金表・契約状態の計算
 *
 * 料金（税抜）:
 *   〜30坪    初回10万円 / 月額7,500円
 *   31〜60坪  初回15万円 / 月額9,800円
 *   61〜100坪 初回20万円 / 月額14,800円
 * 年間契約（開始日の1年後が満了日）。
 */
import type { RatContract } from '@/types/rat';

export interface RatPricing {
  tier: string;
  initialFee: number;
  monthlyFee: number;
}

/** 坪数から料金を求める（100坪超は要見積のため null） */
export function ratPricing(tsubo: number): RatPricing | null {
  if (!tsubo || tsubo <= 0) return null;
  if (tsubo <= 30) return { tier: '〜30坪', initialFee: 100000, monthlyFee: 7500 };
  if (tsubo <= 60) return { tier: '31〜60坪', initialFee: 150000, monthlyFee: 9800 };
  if (tsubo <= 100) return { tier: '61〜100坪', initialFee: 200000, monthlyFee: 14800 };
  return null;
}

/** YYYY-MM-DD にヶ月数を足す（末日超過は月末に丸め） */
export function addMonths(iso: string, months: number): string {
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return iso;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const lastDay = new Date(y, mo + months + 1, 0).getDate();
  const dt = new Date(y, mo + months, Math.min(d, lastDay));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** 今日の日付（YYYY-MM-DD） */
export function todayIso(): string {
  const t = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export type RatStatusKey = 'active' | 'expiring' | 'expired';

export interface RatStatus {
  key: RatStatusKey;
  label: string;
  /** 満了までの残り日数（マイナスは超過日数） */
  daysLeft: number;
}

/** 契約状態（契約中 / 満了間近: 30日以内 / 契約終了） */
export function ratStatus(contract: Pick<RatContract, 'endDate'>, today = todayIso()): RatStatus {
  const ms = Date.parse(contract.endDate) - Date.parse(today);
  const daysLeft = Math.round(ms / 86400000);
  if (Number.isNaN(daysLeft)) return { key: 'active', label: '契約中', daysLeft: 0 };
  if (daysLeft < 0) return { key: 'expired', label: '契約終了', daysLeft };
  if (daysLeft <= 30) return { key: 'expiring', label: '満了間近', daysLeft };
  return { key: 'active', label: '契約中', daysLeft };
}
