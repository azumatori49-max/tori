// 集計（itemStats）の検証。実行: node scripts/check-schedule-stats.mjs
import assert from 'node:assert/strict';
import { itemStats, missingStoresText, statsTable, toCsv, toTsv, csvFileName } from '../src/lib/schedule.ts';

const item = (label, required, max, stores) => ({ label, required, max, source: 'camera', ...(stores ? { stores } : {}) });
const sub = (photos, extra = {}) => ({ count: 0, submittedAt: '', storeName: '', photos, ...extra });
const name = (k) => k.toUpperCase();

// 項目1: 必要1・上限2（枠0,1）、項目2: 必要2・上限2（枠2,3）
const sched = { items: { 0: item('項目1', 1, 2), 1: item('項目2', 2, 2) } };
const subs = {
  a: sub(['u', null, 'u', 'u']), // 全項目達成
  b: sub({ 0: 'u', 1: 'u', 2: 'u' }), // 項目2 が一部（旧形式のオブジェクト）
  c: null, // 提出なし
};
let st = itemStats(sched, subs, ['a', 'b', 'c']);
assert.deepEqual(st.items[0].done, ['a', 'b']);
assert.deepEqual(st.items[0].missing, ['c']);
assert.equal(st.items[0].photoCount, 3);
assert.equal(st.items[0].average, 1);
assert.equal(st.items[0].rate, 2 / 3);
assert.deepEqual(st.items[1].done, ['a']);
assert.deepEqual(st.items[1].partial, [{ key: 'b', count: 1, required: 2 }]);
assert.deepEqual(st.items[1].missing, ['c']);
assert.equal(st.doneStores, 1); assert.equal(st.partialStores, 1); assert.equal(st.noneStores, 1);
assert.equal(st.retiredPhotoCount, 0);
assert.equal(st.items[0].unachievable, false);

// 並べ替え（配列形式）: 枠は順番で決まるので、入れ替えた後も先頭の項目に枠0,1 の写真が集まる
const swapped = { items: [item('項目2', 2, 2), item('項目1', 1, 2)] };
const st2 = itemStats(swapped, subs, ['a', 'b', 'c']);
assert.equal(st2.items[0].photoCount, 3); // 枠0,1
assert.equal(st2.items[1].photoCount, 3); // 枠2,3

// 退役枠: 項目2 を削除すると枠2,3 の写真は「削除・変更された項目の写真」に
st = itemStats({ items: { 0: item('項目1', 1, 2) } }, subs, ['a', 'b', 'c']);
assert.equal(st.items.length, 1);
assert.equal(st.items[0].photoCount, 3);
assert.equal(st.retiredPhotoCount, 3);

// required > max（DB に直接入った壊れたデータ）
st = itemStats({ items: { 0: item('x', 3, 2) } }, { a: sub(['u', 'u']) }, ['a']);
assert.equal(st.items[0].unachievable, true);
assert.deepEqual(st.items[0].partial, [{ key: 'a', count: 2, required: 3 }]);

// 対象外の店舗は分母に入れない（スケジュールの対象外 = targetStoreKeys に無い／項目の対象外 = item.stores）
st = itemStats({ items: { 0: item('x', 1, 1, { a: true }), 1: item('y', 1, 1) } }, { a: sub(['u', 'u']), b: sub(['u', 'u']), z: sub(['u', 'u']) }, ['a', 'b']);
assert.equal(st.items[0].targetCount, 1);
assert.deepEqual(st.items[0].done, ['a']);
assert.equal(st.items[1].targetCount, 2);
assert.equal(st.retiredPhotoCount, 1); // b の枠0（表示しない項目）の写真
assert.deepEqual(st.stores.map((s) => s.counts), [[1, 1], [null, 1]]);

// viaLine は全項目達成扱い
st = itemStats(sched, { a: sub([], { viaLine: true }) }, ['a']);
assert.deepEqual(st.items[0].done, ['a']); assert.deepEqual(st.items[1].done, ['a']);
assert.equal(st.doneStores, 1);

// 提出ゼロ・店舗ゼロ
st = itemStats(sched, {}, ['a']);
assert.deepEqual(st.items[1].missing, ['a']); assert.equal(st.items[1].rate, 0);
st = itemStats(sched, {}, []);
assert.equal(st.items[0].targetCount, 0); assert.equal(st.items[0].average, 0);

// 文面
st = itemStats(sched, subs, ['a', 'b', 'c']);
assert.equal(missingStoresText('T', st.items[0], name), '【T／項目1 未提出のお知らせ】\n■未提出（1店舗）\nC\nお手数ですが、提出をお願いします。');
assert.equal(missingStoresText('T', st.items[1], name), '【T／項目2 未提出のお知らせ】\n■未提出（1店舗）\nC\n■一部（1店舗）\nB（1/2枚）\nお手数ですが、提出をお願いします。');
assert.equal(missingStoresText('T', itemStats(sched, subs, ['a']).items[0], name), null);

// 表・TSV・CSV
const table = statsTable(st, name);
assert.deepEqual(table, [
  ['店舗名', '項目1', '項目2', '状態'],
  ['A', '1', '2', '提出済み'],
  ['B', '2', '1', '一部提出'],
  ['C', '0', '0', '未提出'],
  ['達成店舗数', '2/3', '1/3', ''],
]);
assert.equal(toTsv([['a\tb', 'c\nd']]), 'a b\tc d');
assert.equal(toCsv([['a,b', 'say "hi"', 'x\ny', 'plain']]), '﻿"a,b","say ""hi""","x\ny",plain\r\n');
assert.equal(csvFileName('春/夏 2026', '2026-10-05'), '春_夏 2026_集計_20261005.csv');

console.log('ok: schedule stats checks passed');
