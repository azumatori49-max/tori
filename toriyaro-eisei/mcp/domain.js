/**
 * 衛生管理アプリと同じ日付・集計ロジックの JS 版。
 *
 * ここの値・関数は必ず本体 (src/) と一致させること。
 * 参照元:
 *   - src/lib/dateUtils.ts        （getDateKey / getWeekKey / getMonthKey 等）
 *   - src/data/checkItems.ts      （targetForType, MARUSUKE_STORE_KEYS,
 *                                   MARUSUKE_SWITCH_*, GAS_PRESSURE_START_WEEK,
 *                                   NO_GRIST_STORE_KEYS）
 *   - src/components/store/StoreTopScreen.tsx  （MISS_TRACK_START, countPhotos）
 *   - src/components/admin/MonthlyReportCard.tsx  （集計期間の切り出し方）
 */

const pad = (n) => String(n).padStart(2, '0');
const BUSINESS_DAY_PIVOT_HOUR = 9;

const resolveBase = (base) => {
  if (base) return new Date(base);
  const now = new Date();
  now.setHours(now.getHours() - BUSINESS_DAY_PIVOT_HOUR);
  return now;
};

/** 業務日キー YYYY-MM-DD */
export const getDateKey = (offset = 0, base) => {
  const d = resolveBase(base);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 週キー Wyyyy-mm-dd（月曜起点） */
export const getWeekKey = (offset = 0, base) => {
  const d = resolveBase(base);
  d.setDate(d.getDate() + offset);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return `W${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
};

/** 月キー Myyyy-mm */
export const getMonthKey = (offset = 0, base) => {
  const d = base
    ? new Date(base)
    : (() => {
        const now = new Date();
        now.setHours(now.getHours() - BUSINESS_DAY_PIVOT_HOUR);
        return now;
      })();
  d.setMonth(d.getMonth() + offset);
  return `M${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const formatDateKeyShort = (key) => {
  const [, m, d] = key.split('-');
  return `${Number(m)}/${Number(d)}`;
};

export const formatMonthKeyJa = (monthKey) => {
  const [y, m] = monthKey.slice(1).split('-').map(Number);
  return `${y}年${m}月`;
};

// ----------------------------------------------------------------
// checkItems の targetForType 相当（枚数だけ返す）
// ----------------------------------------------------------------

export const MARUSUKE_STORE_KEYS = new Set([
  'store_703a0c91',
  'store_4a76043d',
  'store_74982693',
  'store_0826b21e',
  'store_a799bbbb',
  'store_7a2c4dd6',
  'store_654ba2d2',
  'store_b39a9c11',
  'store_f1b8e7de',
]);

const NO_GRIST_STORE_KEYS = new Set([
  'store_4187419d', // 北千住店
  'store_3e6bb520', // 福島栄町店
]);

const MARUSUKE_SWITCH_DATE = '2026-07-27';
const MARUSUKE_SWITCH_WEEK = 'W2026-07-27';
const GAS_PRESSURE_START_WEEK = 'W2026-08-31';

// 本体の CheckItem 配列長と一致するよう固定値で持つ
const DAILY_ITEMS_COUNT = 7;                 // ダスター / まな板 / 洗浄機 / ガス元栓 / キッチン床 / 冷蔵庫 / ジョッキ洗浄機
const WEEKLY_ITEMS_COUNT = 8;                // 通常のウィークリー基本セット
const MONTHLY_ITEMS_COUNT = 1;               // モップ交換
const MARUSUKE_DAILY_ITEMS_COUNT = 7;
const MARUSUKE_WEEKLY_ITEMS_COUNT = 7;
const MARUSUKE_DAILY_ITEMS_V2_COUNT = 7;
const MARUSUKE_WEEKLY_ITEMS_V2_COUNT = 8;

const isMarusuke = (storeKey) => !!storeKey && MARUSUKE_STORE_KEYS.has(storeKey);

/** src/data/checkItems.ts の targetForType と同じ結果を返す */
export const targetForType = (type, storeKey, dateOrWeekKey) => {
  if (type === 'monthly') return MONTHLY_ITEMS_COUNT;

  if (isMarusuke(storeKey)) {
    if (type === 'weekly') {
      const key = dateOrWeekKey ?? getWeekKey();
      let base =
        key >= MARUSUKE_SWITCH_WEEK
          ? MARUSUKE_WEEKLY_ITEMS_V2_COUNT
          : MARUSUKE_WEEKLY_ITEMS_COUNT;
      // まる助はコーラが無いので、ガス圧開始週以降は「ビールガス圧」1件のみ追加
      if (key >= GAS_PRESSURE_START_WEEK) base += 1;
      return base;
    }
    const key = dateOrWeekKey ?? getDateKey();
    return key >= MARUSUKE_SWITCH_DATE
      ? MARUSUKE_DAILY_ITEMS_V2_COUNT
      : MARUSUKE_DAILY_ITEMS_COUNT;
  }

  if (type === 'weekly') {
    const key = dateOrWeekKey ?? getWeekKey();
    let base =
      storeKey && NO_GRIST_STORE_KEYS.has(storeKey)
        ? WEEKLY_ITEMS_COUNT - 1
        : WEEKLY_ITEMS_COUNT;
    // 通常店舗はガス圧開始週以降、コーラ＋ビールの2件追加
    if (key >= GAS_PRESSURE_START_WEEK) base += 2;
    return base;
  }

  return DAILY_ITEMS_COUNT;
};

// ----------------------------------------------------------------
// 集計共通
// ----------------------------------------------------------------

/** 未提出集計の開始日（この日より前は数えない）— StoreTopScreen と揃える */
export const MISS_TRACK_START = '2026-07-11';

/** submissions.photos は配列 or `{ '0': url, '1': url, ... }` 混在。有効な文字列だけ数える */
export const countPhotos = (raw) => {
  if (!raw) return 0;
  if (Array.isArray(raw)) {
    return raw.filter((x) => typeof x === 'string' && x.length > 0).length;
  }
  if (typeof raw === 'object') {
    return Object.values(raw).filter(
      (x) => typeof x === 'string' && x.length > 0,
    ).length;
  }
  return 0;
};

/** M2026-09 → { y, m, days } */
export const parseMonthKey = (monthKey) => {
  const match = /^M(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) {
    throw new Error(
      `Invalid monthKey: ${monthKey}. Expected 'M2026-09' style.`,
    );
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const days = new Date(y, m, 0).getDate();
  return { y, m, days };
};

/**
 * 対象月の集計対象日（YYYY-MM-DD）を返す。
 * StoreTopScreen / MonthlyReportCard と同じルール:
 *   - 1日〜（当月なら「昨日」/ 過去月なら月末）
 *   - MISS_TRACK_START より前は除外
 *   - 当日は含めない
 */
export const buildTargetDates = (monthKey) => {
  const { y, m, days } = parseMonthKey(monthKey);
  const todayKey = getDateKey();
  const [ty, tm, td] = todayKey.split('-').map(Number);
  let upper = days;
  if (y === ty && m === tm) upper = td - 1;
  if (upper < 1) return [];
  const from = MISS_TRACK_START;
  const out = [];
  for (let day = 1; day <= upper; day += 1) {
    const k = `${y}-${pad(m)}-${pad(day)}`;
    if (k >= from) out.push(k);
  }
  return out;
};
