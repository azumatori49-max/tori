const { test } = require('node:test');
const assert = require('node:assert');
const { validateOutput } = require('../gas/generate/guard.js');

test('通常の文面は通る', () => {
  const r = validateOutput('本日もよろしくお願いします。昨日の準備、ありがとうございました。', ['田中太郎']);
  assert.equal(r.ok, true);
});

test('人件費への言及を検出', () => {
  const r = validateOutput('人件費が高いので調整してください。', []);
  assert.equal(r.ok, false);
  assert.equal(r.hits[0].cat, 'labor_cost');
});

test('シフト削減・早上がりを検出', () => {
  assert.equal(validateOutput('今日はシフトを減らします。', []).ok, false);
  assert.equal(validateOutput('暇なので早上がりをお願いします。', []).ok, false);
});

test('解雇・懲戒系を検出', () => {
  assert.equal(validateOutput('次にミスをしたら解雇です。', []).ok, false);
  assert.equal(validateOutput('降格もあり得ます。', []).ok, false);
});

test('能力比較を検出', () => {
  assert.equal(validateOutput('ホールで一番提供が遅いのは誰でしょう。', []).ok, false);
});

test('個人名を検出（称賛であっても公開発話では名指ししない）', () => {
  const r = validateOutput('田中太郎さんの接客が素晴らしかったです。', ['田中太郎', '鈴木花子']);
  assert.equal(r.ok, false);
  assert.equal(r.hits[0].cat, 'personal_name');
});

test('1文字の名簿エントリでは誤検出しない', () => {
  assert.equal(validateOutput('今日も一日よろしくお願いします。', ['一']).ok, true);
});
