/**
 * engine/baseline.js — 基準値の算出（純関数）＋ baseline シートの読み書き
 *
 * 大原則：基準値と目標値の分離（§5-B）。
 *  - 係数（曜日・天候・祝前日 = 形）は実績から学んでよい
 *  - 水準（絶対額）は事業計画の日商 PLAN_DAILY_SALES から取り、AIにも実績にも動かさせない
 * これを崩すと「不調が平常になる」自己満足化が起きる。
 */

/**
 * 基準売上を算出する（純関数）。
 * @param {number} planDailySales 事業計画の日商（絶対額）
 * @param {Object} coefs 係数マップ 例: { dow_fri:1.25, weather_rain:0.90, eve_holiday:1.30 }
 * @param {Object} ctx   { dow:'fri', weather:'rain'|'sunny'|'cloudy'|'snow', isEveHoliday:bool }
 * @returns {number} 円
 */
function computeBaselineSales(planDailySales, coefs, ctx) {
  if (!planDailySales || planDailySales <= 0) return 0;
  const dowC = pickCoef_(coefs, 'dow_' + ctx.dow, 1);
  const weatherC = pickCoef_(coefs, 'weather_' + ctx.weather, 1);
  const eveC = ctx.isEveHoliday ? pickCoef_(coefs, 'eve_holiday', 1) : 1;
  return Math.round(planDailySales * dowC * weatherC * eveC);
}

/** 基準客数 = 基準売上 ÷ 計画客単価 */
function computeBaselineGuests(baselineSales, planAvgCheck) {
  if (!planAvgCheck || planAvgCheck <= 0) return 0;
  return Math.round(baselineSales / planAvgCheck);
}

function pickCoef_(coefs, key, fallback) {
  const v = coefs ? coefs[key] : undefined;
  return (typeof v === 'number' && v > 0) ? v : fallback;
}

/**
 * 実績データから曜日係数を再計算する（純関数）。
 * 係数 = その曜日の売上中央値 ÷ 全体中央値。
 * ※ 適用は必ず人の承認を挟む（applyRecalcedCoefs_ 側で担保）。ここは計算のみ。
 * @param {Array<{dow:string, sales:number}>} rows 欠測を除いた実績
 * @returns {Object} { coefs: {dow_mon:..}, sampleN: {dow_mon:..}, overallMedian }
 */
function recalcDowCoefs(rows) {
  const byDow = {};
  const all = [];
  rows.forEach(function (r) {
    if (typeof r.sales !== 'number' || r.sales <= 0) return;
    (byDow[r.dow] = byDow[r.dow] || []).push(r.sales);
    all.push(r.sales);
  });
  const overall = median_(all);
  const coefs = {}, sampleN = {};
  Object.keys(byDow).forEach(function (dow) {
    coefs['dow_' + dow] = overall > 0 ? Math.round(median_(byDow[dow]) / overall * 1000) / 1000 : 1;
    sampleN['dow_' + dow] = byDow[dow].length;
  });
  return { coefs: coefs, sampleN: sampleN, overallMedian: overall };
}

function median_(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort(function (a, b) { return a - b; });
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------- 以下は GAS 環境でのみ動く（シート I/O） ----------

/** baseline シートから係数マップを読む */
function loadCoefs_() {
  const values = getSheet_(CONFIG.SHEET.BASELINE).getDataRange().getValues();
  const coefs = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0]).trim();
    const coef = Number(values[i][1]);
    if (key && !isNaN(coef)) coefs[key] = coef;
  }
  return coefs;
}

/** 今日の文脈で基準値を返す */
function getTodayBaseline_(ctx) {
  const plan = Number(requiredProp_('PLAN_DAILY_SALES'));
  const planAvg = Number(prop_('PLAN_AVG_CHECK', '3000'));
  const sales = computeBaselineSales(plan, loadCoefs_(), ctx);
  return { sales: sales, guests: computeBaselineGuests(sales, planAvg) };
}

/**
 * 開店3ヶ月後の切替（Phase 4）：自店データで曜日係数を再計算し、
 * 新旧の差分を東さんへ LINE 提示する。承認されるまでシートには書かない。
 * 承認後に applyRecalcedCoefs_() を手動実行し、source='own'・履歴行を追加する。
 */
function proposeCoefRecalc() {
  const rows = readDailyRows_(90); // 直近90日
  const result = recalcDowCoefs(rows.filter(function (r) { return r.sales > 0; }));
  const current = loadCoefs_();
  const lines = ['【係数再計算の提案】承認するまで適用されません。'];
  Object.keys(result.coefs).forEach(function (k) {
    lines.push(k + ': ' + (current[k] || '(未設定)') + ' → ' + result.coefs[k] + '（n=' + result.sampleN[k] + '）');
  });
  notifyAdmin_(lines.join('\n'));
  appendLog('info', 'system', '', '係数再計算を提案', JSON.stringify(result.coefs));
  return result;
}

/** 承認済みの係数を適用する（人が手動で実行する。自動実行トリガーに載せないこと） */
function applyRecalcedCoefs_(coefs, sampleN) {
  const sh = getSheet_(CONFIG.SHEET.BASELINE);
  const values = sh.getDataRange().getValues();
  const at = nowIso_();
  Object.keys(coefs).forEach(function (key) {
    let found = false;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === key) {
        // 履歴として旧行を残し（history_ プレフィクス）、現行を更新する
        sh.appendRow(['history_' + key, values[i][1], values[i][2], values[i][3], String(values[i][4] || at)]);
        sh.getRange(i + 1, 2, 1, 4).setValues([[coefs[key], 'own', sampleN[key] || '', at]]);
        found = true;
        break;
      }
    }
    if (!found) sh.appendRow([key, coefs[key], 'own', sampleN[key] || '', at]);
  });
  appendLog('info', 'system', '', '係数を適用（source=own へ切替）', JSON.stringify(coefs));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeBaselineSales, computeBaselineGuests, recalcDowCoefs };
}
