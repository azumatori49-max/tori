/** ネズミ駆除契約の日付・状態計算。料金は手入力。 */
import type { RatContract } from '@/types/rat';

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
