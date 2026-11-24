// ファイル名の規則と zip の UTF-8 フラグの検証。実行: node scripts/check-download.mjs
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { sanitizeFileName, buildPhotoFileName, uniqueFileNames, extFromContentType } from '../src/lib/download.ts';

// 禁止文字・制御文字・空白・前後のドット
assert.equal(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j'), 'a／b＼c：d＊e？f”g＜h＞i｜j');
assert.equal(sanitizeFileName('  .. x\u0000y\tz  .  '), 'x_y z');
assert.equal(sanitizeFileName('a   b\n\nc'), 'a b c');
assert.equal(sanitizeFileName('あ'.repeat(50)).length, 40);

// 長い店名・日本語がそのまま残る
const long = '秩父焼肉ホルモン酒場まる助 大宮一番街店';
assert.equal(
  buildPhotoFileName({ storeName: long, label: 'ウィークリー-防犯カメラ', dateLabel: '20261005', index: 3, ext: 'jpg' }),
  '秩父焼肉ホルモン酒場まる助 大宮一番街店_ウィークリー-防犯カメラ_20261005_3.jpg',
);
// 全体 120 文字を超えたら末尾の要素（日付や項目名）から切る。番号と拡張子は残る
const n = buildPhotoFileName({ storeName: 'あ'.repeat(40), label: 'い'.repeat(40), dateLabel: 'う'.repeat(40), index: 12, ext: 'png' });
assert.ok(n.replace(/\.png$/, '').length <= 120, n);
assert.ok(n.endsWith('_12.png'), n);
assert.ok(n.startsWith('あ'.repeat(40) + '_' + 'い'.repeat(40) + '_'), n);

// 同名の重複
assert.deepEqual(uniqueFileNames(['a.jpg', 'a.jpg', 'b.jpg', 'a.jpg', 'noext']), ['a.jpg', 'a (2).jpg', 'b.jpg', 'a (3).jpg', 'noext']);

// 拡張子
assert.equal(extFromContentType('image/jpeg'), 'jpg');
assert.equal(extFromContentType('image/png; charset=binary'), 'png');
assert.equal(extFromContentType(''), 'jpg');
assert.equal(extFromContentType(null), 'jpg');
assert.equal(extFromContentType('video/mp4'), 'mp4');

// zip: 日本語ファイル名に UTF-8 フラグ（bit 11 = 0x0800）が付く
const zipped = zipSync({ '店舗_項目_20261005_1.jpg': [new Uint8Array([1, 2, 3]), { level: 0 }] });
assert.equal(zipped[0], 0x50); // 'P'
const flag = zipped[6] | (zipped[7] << 8); // local file header の general purpose bit flag
assert.ok(flag & 0x0800, `UTF-8 flag missing: ${flag.toString(16)}`);
const fnLen = zipped[26] | (zipped[27] << 8);
assert.equal(Buffer.from(zipped.subarray(30, 30 + fnLen)).toString('utf8'), '店舗_項目_20261005_1.jpg');

console.log('ok: download checks passed');
