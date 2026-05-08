const pad = (n: number) => String(n).padStart(2, '0');

export const getDateKey = (offset = 0, base?: Date): string => {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const getWeekKey = (offset = 0, base?: Date): string => {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + offset);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return `W${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
};

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

export const formatDateJa = (d: Date): string =>
  `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`;

export const formatDateKeyJa = (key: string): string => {
  const [y, m, day] = key.split('-').map(Number);
  return formatDateJa(new Date(y, m - 1, day));
};

export const formatWeekKeyJa = (weekKey: string): string => {
  const raw = weekKey.replace(/^W/, '');
  return `週: ${raw}`;
};

export const formatSubmittedAt = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const dateKeyToDate = (key: string): Date => {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(y, m - 1, day);
};

export const isFutureDate = (key: string): boolean => {
  const d = dateKeyToDate(key);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() > today.getTime();
};

export const isFutureWeek = (weekKey: string): boolean => {
  const raw = weekKey.replace(/^W/, '');
  const [y, m, day] = raw.split('-').map(Number);
  const monday = new Date(y, m - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return monday.getTime() > today.getTime();
};

export const shiftDateKey = (key: string, days: number): string => {
  const d = dateKeyToDate(key);
  d.setDate(d.getDate() + days);
  return getDateKey(0, d);
};

export const shiftWeekKey = (weekKey: string, weeks: number): string => {
  const raw = weekKey.replace(/^W/, '');
  const [y, m, day] = raw.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + weeks * 7);
  return getWeekKey(0, d);
};
