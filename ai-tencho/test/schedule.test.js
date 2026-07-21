const { test } = require('node:test');
const assert = require('node:assert');
const { dueJobs, TIMETABLE } = require('../gas/engine/schedule.js');

function at(h, m) { return new Date(2026, 10, 4, h, m); }

test('発火時刻前は発火しない', () => {
  assert.deepEqual(dueJobs(at(14, 25), [], 1, TIMETABLE).map(j => j.id), []);
});

test('14:30 に朝礼が発火する', () => {
  const ids = dueJobs(at(14, 30), [], 1, TIMETABLE).map(j => j.id);
  assert.ok(ids.includes('brief'));
});

test('発火済みは再発火しない', () => {
  const ids = dueJobs(at(14, 35), ['brief'], 1, TIMETABLE).map(j => j.id);
  assert.ok(!ids.includes('brief'));
});

test('Phase 1 では時間帯指示（17:00等）が発火しない', () => {
  const ids = dueJobs(at(17, 0), [], 1, TIMETABLE).map(j => j.id);
  assert.ok(!ids.includes('peak_prep'));
});

test('Phase 2 では 17:00 のピーク前が発火する', () => {
  const ids = dueJobs(at(17, 0), [], 2, TIMETABLE).map(j => j.id);
  assert.ok(ids.includes('peak_prep'));
});

test('2時間以上過ぎた取りこぼしは発火しない（深夜に朝礼を鳴らさない）', () => {
  const ids = dueJobs(at(17, 0), [], 1, TIMETABLE).map(j => j.id);
  assert.ok(!ids.includes('brief'));
});

test('00:30 に日次振り返りが発火する', () => {
  const ids = dueJobs(at(0, 30), [], 1, TIMETABLE).map(j => j.id);
  assert.ok(ids.includes('daily_review'));
});
