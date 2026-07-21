/**
 * engine/rules_config.js — 判定ルール定義（Phase 1）
 *
 * ★ここが正。docs/RULES.md は人間向けの写し。変更時は必ず両方を更新すること。
 * （仕様書は RULES.md を実行時に読み込むとしていたが、Markdownパースは
 *   無人発話の判定基盤として壊れやすいため JS定義に変更。CHANGES_FROM_SPEC.md #2）
 *
 * when の条件はすべて AND。gap は (実績−基準)/基準×100 の %。
 * 評価は priority 昇順で最初に一致したもの1つ。A-01 は条件なしのデフォルト。
 */

const RULES = [
  {
    code: 'Z-01', name: 'データ欠測', priority: 1,
    severity: 'info', to: 'manager',
    when: { missing: true },
    intent: '数値に一切触れず、定型文で運用を続ける',
    tasks: []
  },
  {
    code: 'B-01', name: '集客不足', priority: 2,
    severity: 'alert', to: 'manager',
    when: { sales_gap_lte: -5, guests_gap_lte: -5 },
    intent: '集客要因。当日にできることは少ない。事実の共有に留め、原因の断定はしない',
    tasks: []
  },
  {
    code: 'D-02', name: '客単価低下', priority: 3,
    severity: 'alert', to: 'manager',
    when: { sales_gap_lte: -5, guests_gap_gt: -5 },
    intent: '客単価要因。2杯目の声掛け等、当日の動きで変えられる。店長の承認を得てタスク化する',
    tasks: [{ title: '全卓ドリンク残量チェック', to: 'hall', due_min: 20 }]
  },
  {
    code: 'E-01', name: '好調', priority: 4,
    severity: 'praise', to: 'hall',
    when: { sales_gap_gte: 8 },
    intent: '好調の共有と称賛。提供速度の維持を促す',
    tasks: []
  },
  {
    code: 'A-01', name: '平常', priority: 9,
    severity: 'info', to: 'hall',
    when: {},
    intent: '平常運転',
    tasks: []
  }
];

// Node のテストから読めるようにする（GAS では無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RULES };
}
