/**
 * datasource/daily.js — 日報シート（daily）の読み書き
 *
 * 1行1日の構造化データ（§4-1）。テキストで書かせない。
 * 店長が手入力するのは sales / guests / checks / reservations / manager_note 程度。
 * 自動取得できる列（date/dow/weather/祝日/タスク集計）は GAS が埋める。
 */

const DAILY_HEADER = [
  'date', 'dow', 'sales', 'guests', 'checks',
  'weather', 'temp_max', 'precip',
  'is_holiday', 'is_eve_holiday',
  'reservations', 'reservation_guests',
  'labor_hours', 'staff_count',
  'task_completed', 'task_total',
  'manager_note', 'incidents'
];

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** 指定日の行を取得（無ければ null）。dateStr: 'yyyy-MM-dd' */
function getDailyRow_(dateStr) {
  const sh = getSheet_(CONFIG.SHEET.DAILY);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const d = values[i][0];
    const s = (d instanceof Date) ? Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd') : String(d);
    if (s === dateStr) return rowToObj_(values[i], i + 1);
  }
  return null;
}

function rowToObj_(row, rowIndex) {
  const obj = { _row: rowIndex };
  DAILY_HEADER.forEach(function (h, idx) {
    obj[h] = row[idx] === '' ? null : row[idx];
  });
  // 数値列の正規化（空欄は null のまま＝欠測）
  ['sales', 'guests', 'checks', 'temp_max', 'precip', 'reservations',
   'reservation_guests', 'labor_hours', 'staff_count',
   'task_completed', 'task_total', 'incidents'].forEach(function (k) {
    if (obj[k] !== null) obj[k] = Number(obj[k]);
  });
  return obj;
}

/** 当日行が無ければ作成し、自動列（date/dow/weather/祝日）を埋める。毎朝のジョブから呼ぶ */
function ensureTodayRow_() {
  const dateStr = businessDate(new Date());
  let row = getDailyRow_(dateStr);
  const sh = getSheet_(CONFIG.SHEET.DAILY);
  if (!row) {
    const d = new Date(dateStr + 'T12:00:00');
    sh.appendRow([dateStr, DOW_KEYS[d.getDay()]]);
    row = getDailyRow_(dateStr);
  }
  // 自動付与列（絶対に手入力させない：§4-1）
  const patch = {};
  try {
    const w = fetchTodayWeather_();
    patch.weather = w.weather; patch.temp_max = w.tempMax; patch.precip = w.precip;
  } catch (e) { logError_(e, 'weather取得'); }
  try {
    patch.is_holiday = isJapaneseHoliday_(new Date(dateStr + 'T12:00:00'));
    patch.is_eve_holiday = isEveOfHoliday_(new Date(dateStr + 'T12:00:00'));
  } catch (e) { logError_(e, '祝日判定'); }
  updateDailyRow_(dateStr, patch);
  return getDailyRow_(dateStr);
}

/** 指定日の行の一部の列だけ更新する */
function updateDailyRow_(dateStr, patch) {
  const row = getDailyRow_(dateStr);
  if (!row) return;
  const sh = getSheet_(CONFIG.SHEET.DAILY);
  Object.keys(patch).forEach(function (key) {
    const col = DAILY_HEADER.indexOf(key);
    if (col >= 0 && patch[key] !== undefined) {
      sh.getRange(row._row, col + 1).setValue(patch[key]);
    }
  });
}

/** 直近 n 日分の実績を返す（係数再計算・プロンプト用） */
function readDailyRows_(n) {
  const sh = getSheet_(CONFIG.SHEET.DAILY);
  const values = sh.getDataRange().getValues();
  const rows = [];
  for (let i = Math.max(1, values.length - n); i < values.length; i++) {
    rows.push(rowToObj_(values[i], i + 1));
  }
  return rows;
}
