/**
 * generate/guard.js — 禁止語フィルタ・出力検証（§8-2）
 *
 * 生成後・配信前に必ず通す。1つでも該当したらフォールバック文面に差し替え、東さんへ通知。
 * ここは安全装置の中核なので、判定は正規表現の決定論のみ。AIに判定させない。
 * テスト: test/guard.test.js
 */

// カテゴリ別の禁止パターン。公開チャネル（音声・モニター・スタッフLINE）向け出力に適用する。
const BANNED_PATTERNS = [
  // 人件費削減・シフト削減への言及（§6-B: 店長スマホ以外に出さない）
  { cat: 'labor_cost', re: /人件費/ },
  { cat: 'labor_cost', re: /シフト(を|の)?(削|減|カット|調整)/ },
  { cat: 'labor_cost', re: /早上がり|早あがり/ },
  { cat: 'labor_cost', re: /(人|スタッフ|人員)(を|が)?(減ら|多すぎ|余っ)/ },
  // 解雇・降格・懲戒を想起させる表現
  { cat: 'discipline', re: /解雇|クビ|くび切/ },
  { cat: 'discipline', re: /降格|懲戒|処分|始末書/ },
  { cat: 'discipline', re: /(辞め|やめ)(て|させ|ろ)/ },
  // 能力比較・評価
  { cat: 'comparison', re: /(より|比べて).{0,10}(遅い|できない|劣|下手)/ },
  { cat: 'comparison', re: /(一番|最も).{0,6}(遅い|できない|ミスが多い)/ }
];

/**
 * 公開チャネル向けの出力を検証する（純関数）。
 * @param {string} text 生成文面
 * @param {Array<string>} staffNames 在籍スタッフの氏名（個人名指摘の検出用）
 * @returns {{ok:boolean, hits:Array<{cat:string, matched:string}>}}
 */
function validateOutput(text, staffNames) {
  const hits = [];
  const t = String(text || '');
  BANNED_PATTERNS.forEach(function (p) {
    const m = t.match(p.re);
    if (m) hits.push({ cat: p.cat, matched: m[0] });
  });
  // 個人名を挙げた指摘・評価：称賛であっても公開チャネルの自動発話では個人名を出さない。
  // 「誰を褒めるか」の選別も比較になるため、名指しは店長の口から行う運用に倒す。
  (staffNames || []).forEach(function (name) {
    const n = String(name || '').trim();
    if (n.length >= 2 && t.indexOf(n) >= 0) hits.push({ cat: 'personal_name', matched: n });
  });
  return { ok: hits.length === 0, hits: hits };
}

// ---------- GAS 環境のみ ----------

/** staff シートから氏名一覧を読む */
function loadStaffNames_() {
  try {
    const values = getSheet_(CONFIG.SHEET.STAFF).getDataRange().getValues();
    const names = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i][0]) names.push(String(values[i][0]).trim());
    }
    return names;
  } catch (e) {
    return [];
  }
}

/**
 * ガードを通し、NG ならフォールバック文面に差し替えて管理者へ通知する。
 * 公開チャネルに出すテキストは必ずこの関数を経由すること。
 */
function guardOrFallback_(text, fallbackText, kind) {
  const result = validateOutput(text, loadStaffNames_());
  if (result.ok) return { text: text, guarded: false };
  const detail = result.hits.map(function (h) { return h.cat + ':' + h.matched; }).join(', ');
  appendLog('warn', 'system', '', '禁止語検出のため差し替え (' + kind + '): ' + detail, '');
  notifyAdmin_('【禁止語フィルタ】' + kind + ' の生成文面を差し替えました。\n検出: ' + detail);
  return { text: fallbackText, guarded: true };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateOutput, BANNED_PATTERNS };
}
