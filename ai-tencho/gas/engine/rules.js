/**
 * engine/rules.js — ルールエンジン（決定論的・純関数）
 *
 * 大原則：判定は機械、表現はAI、決定は人。
 * この関数は Spreadsheet にも Claude にも依存しない。同じ入力なら必ず同じ出力。
 * テスト: test/rules.test.js
 */

/**
 * 日次実績を判定し、状態コードを返す。
 *
 * @param {Object} input
 *   {number|null} sales          実績売上（欠測なら null）
 *   {number|null} guests         実績客数（欠測なら null）
 *   {number}      baselineSales  基準売上（baseline.js で算出）
 *   {number}      baselineGuests 基準客数
 * @param {Array} rules  省略時はグローバル RULES（rules_config.js）
 * @param {Object} opts  {noBlameGapPct: 15} 断定禁止の閾値
 * @returns {Object} {
 *   code, rule,
 *   facts: { sales_gap_pct, guests_gap_pct, avg_check, baseline_avg_check, avg_check_gap_pct },
 *   flags: { missing, no_blame }
 * }
 */
function evaluateRules(input, rules, opts) {
  rules = rules || (typeof RULES !== 'undefined' ? RULES : null);
  if (!rules) throw new Error('ルール定義がありません');
  const noBlameGap = (opts && opts.noBlameGapPct) || 15;

  const missing =
    input.sales === null || input.sales === undefined || isNaN(input.sales) ||
    input.guests === null || input.guests === undefined || isNaN(input.guests) ||
    !input.baselineSales || input.baselineSales <= 0;

  const facts = { sales_gap_pct: null, guests_gap_pct: null, avg_check: null, baseline_avg_check: null, avg_check_gap_pct: null };

  if (!missing) {
    facts.sales_gap_pct = round1_((input.sales - input.baselineSales) / input.baselineSales * 100);
    if (input.baselineGuests > 0 && input.guests !== null) {
      facts.guests_gap_pct = round1_((input.guests - input.baselineGuests) / input.baselineGuests * 100);
    }
    if (input.guests > 0) facts.avg_check = Math.round(input.sales / input.guests);
    if (input.baselineGuests > 0) facts.baseline_avg_check = Math.round(input.baselineSales / input.baselineGuests);
    if (facts.avg_check !== null && facts.baseline_avg_check > 0) {
      facts.avg_check_gap_pct = round1_((facts.avg_check - facts.baseline_avg_check) / facts.baseline_avg_check * 100);
    }
  }

  const ctx = { missing: missing, sales_gap: facts.sales_gap_pct, guests_gap: facts.guests_gap_pct };
  const sorted = rules.slice().sort(function (a, b) { return a.priority - b.priority; });
  let matched = null;
  for (let i = 0; i < sorted.length; i++) {
    if (matchWhen_(sorted[i].when, ctx)) { matched = sorted[i]; break; }
  }
  if (!matched) matched = sorted[sorted.length - 1]; // 保険（A-01 が必ず拾う設計だが）

  return {
    code: matched.code,
    rule: matched,
    facts: facts,
    flags: {
      missing: missing,
      // 乖離が大きい日は外部要因の可能性。文面生成で断定を禁止する（§5）
      no_blame: !missing && Math.abs(facts.sales_gap_pct) >= noBlameGap
    }
  };
}

/** when 条件の評価。全条件 AND。未知のキーがあれば例外（定義ミスを黙殺しない） */
function matchWhen_(when, ctx) {
  const keys = Object.keys(when || {});
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], v = when[k];
    let ok;
    switch (k) {
      case 'missing':        ok = ctx.missing === v; break;
      case 'sales_gap_lte':  ok = !ctx.missing && ctx.sales_gap !== null && ctx.sales_gap <= v; break;
      case 'sales_gap_gte':  ok = !ctx.missing && ctx.sales_gap !== null && ctx.sales_gap >= v; break;
      case 'guests_gap_lte': ok = !ctx.missing && ctx.guests_gap !== null && ctx.guests_gap <= v; break;
      case 'guests_gap_gt':  ok = !ctx.missing && ctx.guests_gap !== null && ctx.guests_gap > v; break;
      default: throw new Error('未知のルール条件: ' + k);
    }
    if (!ok) return false;
  }
  // 欠測時に missing 条件を持たないルールへ流れ込まないようにする
  if (ctx.missing && when.missing !== true) return false;
  return true;
}

function round1_(n) { return Math.round(n * 10) / 10; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { evaluateRules };
}
