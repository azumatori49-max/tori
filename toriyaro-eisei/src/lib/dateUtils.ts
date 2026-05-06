const pad = (n: number) => String(n).padStart(2, '0');

const formatYmd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const getDateKey = (offset = 0): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return formatYmd(d);
};

const mondayOf = (d: Date): Date => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(diff);
  return m;
};

export const getWeekKey = (offset = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `W${formatYmd(mondayOf(d))}`;
};

export const getDateKeyFromDate = (d: Date): string => formatYmd(d);

export const getWeekKeyFromDate = (d: Date): string => `W${formatYmd(mondayOf(d))}`;

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

export const formatDateJa = (d: Date): string =>
  `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS_JA[d.getDay()]}）`;

export const formatWeekRangeJa = (mondayDate: Date): string => {
  const sun = new Date(mondayDate);
  sun.setDate(sun.getDate() + 6);
  return `${mondayDate.getMonth() + 1}/${mondayDate.getDate()}（月）〜 ${sun.getMonth() + 1}/${sun.getDate()}（日）`;
};

export const dateKeyToDate = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const weekKeyToMonday = (key: string): Date => {
  const ymd = key.startsWith('W') ? key.slice(1) : key;
  return dateKeyToDate(ymd);
};

export const formatTimestampJa = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const isFutureDate = (d: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return target.getTime() > today.getTime();
};
