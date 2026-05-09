const pad = (n: number) => String(n).padStart(2, "0");

const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const getDateKey = (offset = 0, base?: Date): string => {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + offset);
  return fmt(d);
};

export const getMondayOf = (base: Date): Date => {
  const d = new Date(base);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return mon;
};

export const getWeekKey = (offset = 0, base?: Date): string => {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + offset);
  const mon = getMondayOf(d);
  return `W${fmt(mon)}`;
};

const WD = ["日", "月", "火", "水", "木", "金", "土"];

export const formatDateJa = (d: Date): string =>
  `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;

export const formatDateTimeJa = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const dateKeyToDate = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const weekKeyToDate = (key: string): Date => {
  return dateKeyToDate(key.replace(/^W/, ""));
};
