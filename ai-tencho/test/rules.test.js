/**
 * rules.js の単体テスト。
 * 無人発話の判定基盤なので、閾値の境界を必ず固定する。
 * 実行: node --test ai-tencho/test/
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { evaluateRules } = require('../gas/engine/rules.js');
const { RULES } = require('../gas/engine/rules_config.js');

function evalWith(sales, guests, baseSales, baseGuests) {
  return evaluateRules(
    { sales, guests, baselineSales: baseSales, baselineGuests: baseGuests },
    RULES, { noBlameGapPct: 15 }
  );
}

test('A-01: ±5%圏内は平常', () => {
  const r = evalWith(300000, 100, 300000, 100);
  assert.equal(r.code, 'A-01');
  assert.equal(r.flags.no_blame, false);
});

test('A-01: 境界 −5%ちょうどは B/D 側（lte）', () => {
  // 売上 −5.0%・客数横ばい → D-02（lte -5 に一致）
  const r = evalWith(285000, 100, 300000, 100);
  assert.equal(r.code, 'D-02');
});

test('A-01: −4.9% は平常', () => {
  const r = evalWith(285300, 100, 300000, 100);
  assert.equal(r.code, 'A-01');
});

test('B-01: 売上も客数も −5%超 → 集客要因', () => {
  const r = evalWith(270000, 90, 300000, 100);
  assert.equal(r.code, 'B-01');
});

test('D-02: 売上 −5%超・客数横ばい → 客単価要因', () => {
  const r = evalWith(270000, 99, 300000, 100);
  assert.equal(r.code, 'D-02');
  assert.equal(r.facts.avg_check, Math.round(270000 / 99));
});

test('E-01: +8%以上は好調', () => {
  const r = evalWith(324000, 105, 300000, 100);
  assert.equal(r.code, 'E-01');
});

test('E-01 境界: +7.9% は平常', () => {
  const r = evalWith(323700, 100, 300000, 100);
  assert.equal(r.code, 'A-01');
});

test('Z-01: 売上欠測', () => {
  const r = evalWith(null, 100, 300000, 100);
  assert.equal(r.code, 'Z-01');
  assert.equal(r.flags.missing, true);
  // 欠測時は facts の数値がすべて null（数字に触れない担保）
  assert.equal(r.facts.sales_gap_pct, null);
});

test('Z-01: 基準値が無い（開店初日など）も欠測扱い', () => {
  const r = evalWith(300000, 100, 0, 0);
  assert.equal(r.code, 'Z-01');
});

test('no_blame: 乖離15%以上で断定禁止フラグ', () => {
  const down = evalWith(250000, 80, 300000, 100); // −16.7%
  assert.equal(down.code, 'B-01');
  assert.equal(down.flags.no_blame, true);
  const up = evalWith(350000, 110, 300000, 100); // +16.7%
  assert.equal(up.code, 'E-01');
  assert.equal(up.flags.no_blame, true);
});

test('決定論: 同じ入力は同じ出力', () => {
  const a = evalWith(270000, 99, 300000, 100);
  const b = evalWith(270000, 99, 300000, 100);
  assert.deepEqual(a, b);
});

test('未知の条件キーは例外（定義ミスを黙殺しない）', () => {
  assert.throws(() => {
    evaluateRules(
      { sales: 1, guests: 1, baselineSales: 1, baselineGuests: 1 },
      [{ code: 'X', priority: 1, when: { typo_key: 1 }, tasks: [] }]
    );
  });
});
