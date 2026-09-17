const pad = (n: number) => String(n).padStart(2, '0');

// 業務日の切り替え時刻（午前9時）。
// この時刻になるまでは前日の業務日として扱う。
const BUSINESS_DAY_PIVOT_HOUR = 9;

// 引数 base がない場合は「今＝業務日」を返す。
// base がある場合はそのまま（カレンダー日付として扱う）。
const resolveBase = (base?: Date): Date => {
  if (base) return new Date(base);
  const now = new Date();
  now.setHours(now.getHours() - BUSINESS_DAY_PIVOT_HOUR);
  return now;
};

export const getDateKey = (offset = 0, base?: Date): string => {
  const d = resolveBase(base);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const getWeekKey = (offset = 0, base?: Date): string => {
  const d = resolveBase(base);
  d.setDate(d.getDate() + offset);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return `W${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
};

export const formatDateJa = (d: Date): string => {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
};

export const formatDateKeyJa = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  return formatDateJa(new Date(y, m - 1, d));
};

export const weekKeyToDate = (weekKey: string): Date => {
  const k = weekKey.startsWith('W') ? weekKey.slice(1) : weekKey;
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const dateKeyToDate = (dateKey: string): Date => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatDateTimeJa = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const isFutureDate = (dateKey: string): boolean => {
  return dateKey > getDateKey();
};

export const isFutureWeek = (weekKey: string): boolean => {
  return weekKey > getWeekKey();
};
export const formatDateKeyShort = (key: string): string => {
  const [, m, d] = key.split('-');
  return `${Number(m)}/${Number(d)}`;
};

export const formatWeekKeyRange = (weekKey: string): string => {
  const mon = weekKeyToDate(weekKey);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()} 〜 ${sun.getMonth() + 1}/${sun.getDate()}`;
};

export const isPivotActive = (): boolean => new Date().getHours() < 9;

/** 月キー（例 "M2026-07"）。業務日9時切替を反映 */
export const getMonthKey = (offset = 0, base?: Date): string => {
  const d = base ? new Date(base) : (() => {
    const now = new Date();
    now.setHours(now.getHours() - 9);
    return now;
  })();
  d.setMonth(d.getMonth() + offset);
  return `M${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const isFutureMonth = (monthKey: string): boolean => {
  return monthKey > getMonthKey();
};

export const formatMonthKeyJa = (monthKey: string): string => {
  const [y, m] = monthKey.slice(1).split('-').map(Number);
  return `${y}年${m}月`;
};

export const monthKeyToDate = (monthKey: string): Date => {
  const [y, m] = monthKey.slice(1).split('-').map(Number);
  return new Date(y, m - 1, 1);
};