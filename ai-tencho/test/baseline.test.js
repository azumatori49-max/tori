const { test } = require('node:test');
const assert = require('node:assert');
const { computeBaselineSales, computeBaselineGuests, recalcDowCoefs } = require('../gas/engine/baseline.js');

test('基準値 = 計画日商 × 曜日 × 天候 × 祝前日', () => {
  const coefs = { dow_fri: 1.3, weather_rain: 0.9, eve_holiday: 1.25 };
  assert.equal(
    computeBaselineSales(300000, coefs, { dow: 'fri', weather: 'rain', isEveHoliday: true }),
    Math.round(300000 * 1.3 * 0.9 * 1.25)
  );
});

test('係数が無いキーは 1.0 扱い（欠けても止まらない）', () => {
  assert.equal(computeBaselineSales(300000, {}, { dow: 'mon', weather: 'sunny', isEveHoliday: false }), 300000);
});

test('計画日商が未設定なら 0（欠測として扱われ Z-01 へ落ちる）', () => {
  assert.equal(computeBaselineSales(0, {}, { dow: 'mon', weather: 'sunny', isEveHoliday: false }), 0);
});

test('基準客数 = 基準売上 ÷ 計画客単価', () => {
  assert.equal(computeBaselineGuests(300000, 3000), 100);
  assert.equal(computeBaselineGuests(300000, 0), 0);
});

test('曜日係数の再計算は中央値ベース', () => {
  const rows = [
    { dow: 'fri', sales: 400000 }, { dow: 'fri', sales: 420000 }, { dow: 'fri', sales: 380000 },
    { dow: 'mon', sales: 200000 }, { dow: 'mon', sales: 210000 }, { dow: 'mon', sales: 190000 }
  ];
  const r = recalcDowCoefs(rows);
  // 全体中央値 = (210000+380000)/2 = 295000
  assert.equal(r.overallMedian, 295000);
  assert.equal(r.coefs.dow_fri, Math.round(400000 / 295000 * 1000) / 1000);
  assert.equal(r.sampleN.dow_fri, 3);
});

test('売上0や欠測の行は係数計算から除外', () => {
  const r = recalcDowCoefs([{ dow: 'mon', sales: 0 }, { dow: 'mon', sales: 100 }]);
  assert.equal(r.sampleN.dow_mon, 1);
});
