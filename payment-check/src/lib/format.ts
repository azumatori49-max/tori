export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, diff: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${Number(m)}月`;
}

export function formatYen(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}¥${Math.abs(amount).toLocaleString("ja-JP")}`;
}

export function formatDateJa(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

export function formatDateSlash(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function dateOf(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) /
      86400000
  );
}

export function formatDateTime(ts: string): string {
  // "2026-06-06 11:57:00" → "2026/06/06 11:57"
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return ts;
  return `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}`;
}
