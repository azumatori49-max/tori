/**
 * 請求金額の計算ロジック
 *
 * スプレッドシートの内訳:
 *   メンテナンス  50,000
 *   備品 資材 廃棄 22,500
 *   税抜き        72,500 = メンテナンス + 備品資材廃棄
 *   請求額（税込） 79,750 = 税抜き × 1.1（端数四捨五入）
 */
import type {
  AnnualSchedule,
  DiyItem,
  MaintenanceReport,
  SupplyLine,
  ToppingItem,
} from '@/types/report';

/** 備品資材1行の金額 */
export function supplyAmount(line: SupplyLine): number {
  return Math.round((line.unitPrice || 0) * (line.qty || 0));
}

/** 備品資材の合計（円・税抜） */
export function suppliesTotal(supplies: SupplyLine[]): number {
  return supplies.reduce((sum, l) => sum + supplyAmount(l), 0);
}

/** チェックされたトッピングの追加費用合計（円・税抜） */
export function toppingsTotal(toppings: ToppingItem[]): number {
  return toppings
    .filter((t) => t.checked)
    .reduce((sum, t) => sum + (t.fee || 0), 0);
}

/** チェックされたプチDIYの追加費用合計（円・税抜） */
export function diyTotal(diy: DiyItem[]): number {
  return diy.filter((d) => d.checked).reduce((sum, d) => sum + (d.fee || 0), 0);
}

export interface BillingBreakdown {
  /** メンテナンス料金 */
  maintenance: number;
  /** 備品 資材 廃棄 */
  supplies: number;
  /** トッピング追加費用 */
  toppings: number;
  /** プチDIY追加費用 */
  diy: number;
  /** 年間スケジュール追加費用 */
  annual: number;
  /** 税抜き合計 */
  taxExcluded: number;
  /** 消費税額 */
  tax: number;
  /** 請求額（税込） */
  taxIncluded: number;
}

/** レポートから請求内訳を計算する */
export function calcBilling(report: {
  maintenanceFee: number;
  taxRate: number;
  supplies: SupplyLine[];
  toppings: ToppingItem[];
  diy: DiyItem[];
  annualSchedule: AnnualSchedule;
}): BillingBreakdown {
  const maintenance = report.maintenanceFee || 0;
  const supplies = suppliesTotal(report.supplies);
  const toppings = toppingsTotal(report.toppings);
  const diy = diyTotal(report.diy);
  const annual = report.annualSchedule?.fee || 0;
  const taxExcluded = maintenance + supplies + toppings + diy + annual;
  const taxIncluded = Math.round(taxExcluded * (1 + (report.taxRate || 0)));
  const tax = taxIncluded - taxExcluded;
  return { maintenance, supplies, toppings, diy, annual, taxExcluded, tax, taxIncluded };
}

/** 千円区切りの金額表示（例: 79750 → "79,750"） */
export function yen(n: number): string {
  return (n || 0).toLocaleString('ja-JP');
}

export type { MaintenanceReport };
