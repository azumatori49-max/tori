/**
 * ops/feedback.js — フィードバックループの記録処理（§5-B ③・STEP 14）
 *
 * ★開店初日から溜め始めること。集計・降格ロジックは後でよいが、記録は先。
 *
 * Phase 1 の制約: データ源が日次の日報のみのため、仕様書の metric_after_60（発報60分後の指標）
 * は物理的に取得できない。列は確保しておき、POS連携（Phase 3）から埋める。
 * それまでは delta_daily（当日終了時点の基準比）を参考値として記録する。
 * （docs/CHANGES_FROM_SPEC.md #3）
 */

const FEEDBACK_HEADER = [
  'date', 'time', 'rule_code', 'task_id', 'task_title',
  'approved',        // 店長が承認したか
  'completed',       // スタッフが完了報告したか
  'completed_min',   // 発報から完了までの分数
  'metric_before',   // 発報時点の対象指標（Phase 3 から。日次運用では基準比%を入れる）
  'metric_after_60', // 60分後の同指標（Phase 3 から）
  'delta',           // 差分（Phase 3 から）
  'delta_daily'      // 当日終了時点の売上gap%（Phase 1 の参考値。振り返りジョブで記入）
];

/** 発報を記録する。taskId はタスクを伴わない発報なら '' */
function recordIssue_(ruleCode, taskId, taskTitle, metricBefore) {
  getSheet_(CONFIG.SHEET.FEEDBACK).appendRow([
    businessDate(new Date()),
    Utilities.formatDate(new Date(), CONFIG.TZ, 'HH:mm'),
    ruleCode, taskId || '', taskTitle || '',
    '', '', '', metricBefore === undefined ? '' : metricBefore, '', '', ''
  ]);
}

function findFeedbackRowByTask_(taskId) {
  const sh = getSheet_(CONFIG.SHEET.FEEDBACK);
  const values = sh.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][3]) === String(taskId)) return { sh: sh, row: i + 1, values: values[i] };
  }
  return null;
}

function markTaskApproved_(taskId, approved) {
  const hit = findFeedbackRowByTask_(taskId);
  if (hit) hit.sh.getRange(hit.row, FEEDBACK_HEADER.indexOf('approved') + 1).setValue(approved);
}

/** スタッフの完了報告（LINE postback）を記録し、Firebase 側のタスクも完了にする */
function recordTaskCompleted_(taskId, doneBy) {
  const hit = findFeedbackRowByTask_(taskId);
  if (hit) {
    const issuedAt = new Date(hit.values[0] + 'T' + hit.values[1] + ':00');
    const min = Math.max(0, Math.round((Date.now() - issuedAt.getTime()) / 60000));
    hit.sh.getRange(hit.row, FEEDBACK_HEADER.indexOf('completed') + 1).setValue(true);
    hit.sh.getRange(hit.row, FEEDBACK_HEADER.indexOf('completed_min') + 1).setValue(min);
  }
  fbUpdate_('store/tasks/' + taskId, { done: true, done_by: doneBy || null, done_at: nowIso_() });
  appendLog('info', 'task', '', 'タスク完了: ' + taskId, 'by:' + (doneBy || '不明'));
}

/** 当日の feedback 行に delta_daily（当日終了時の売上gap%）を書く。振り返りジョブから呼ぶ */
function fillDailyDelta_(dateStr, salesGapPct) {
  const sh = getSheet_(CONFIG.SHEET.FEEDBACK);
  const values = sh.getDataRange().getValues();
  const col = FEEDBACK_HEADER.indexOf('delta_daily') + 1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === dateStr && values[i][col - 1] === '') {
      sh.getRange(i + 1, col).setValue(salesGapPct);
    }
  }
}

/** 日次サマリー用のタスク集計 */
function countFeedback_(dateStr) {
  const values = getSheet_(CONFIG.SHEET.FEEDBACK).getDataRange().getValues();
  let total = 0, completed = 0;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) !== dateStr) continue;
    if (!values[i][3]) continue; // タスクを伴う発報のみ数える
    total++;
    if (values[i][FEEDBACK_HEADER.indexOf('completed')] === true) completed++;
  }
  return { total: total, completed: completed };
}

/**
 * 自動降格の検知（§5-B）。週1回のトリガーで実行。
 * ★自動では止めない。要見直しフラグを東さんへ通知するだけ（人の承認が必須）。
 */
function checkRuleDemotion() {
  const values = getSheet_(CONFIG.SHEET.FEEDBACK).getDataRange().getValues();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
  const stats = {}; // rule_code → {total, completed}
  for (let i = 1; i < values.length; i++) {
    const d = new Date(String(values[i][0]) + 'T00:00:00');
    if (isNaN(d.getTime()) || d < cutoff || !values[i][3]) continue;
    const code = String(values[i][2]);
    stats[code] = stats[code] || { total: 0, completed: 0 };
    stats[code].total++;
    if (values[i][FEEDBACK_HEADER.indexOf('completed')] === true) stats[code].completed++;
  }
  const warnings = [];
  Object.keys(stats).forEach(function (code) {
    const s = stats[code];
    if (s.total >= 5 && s.completed / s.total < 0.4) {
      warnings.push(code + ': 直近14日の実施率 ' + Math.round(s.completed / s.total * 100) + '%（' + s.completed + '/' + s.total + '）');
    }
  });
  if (warnings.length) {
    notifyAdmin_('【要見直し】実施率が40%を下回っている指示があります。文面・タイミング・実行可能性の見直し候補です（自動では止めていません）。\n' + warnings.join('\n'));
  }
}
