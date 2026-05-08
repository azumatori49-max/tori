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
