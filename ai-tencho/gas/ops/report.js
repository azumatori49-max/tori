/**
 * ops/report.js — 日次サマリー（§8-5）
 * 毎朝8時に「昨日の発話◯件 / タスク実施率◯% / エラー◯件」を東さんへ自動送信する。
 * 無人稼働で「壊れていても誰も気づかない」を防ぐ最後の砦。毎日必ず届くこと自体が生存報告。
 */

function sendDailySummary_() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = Utilities.formatDate(yesterday, CONFIG.TZ, 'yyyy-MM-dd');

  const logs = countLogs(dateStr);
  const fb = countFeedback_(dateStr);
  const row = getDailyRow_(dateStr);

  const lines = ['【日次サマリー ' + dateStr + '】'];
  lines.push('発話 ' + logs.speeches + '件 / エラー ' + logs.errors + '件');
  lines.push('タスク ' + fb.completed + '/' + fb.total +
    (fb.total > 0 ? '（実施率 ' + Math.round(fb.completed / fb.total * 100) + '%）' : ''));
  if (row && row.sales) {
    lines.push('売上 ' + Number(row.sales).toLocaleString() + '円 / 客数 ' + (row.guests || '未入力'));
  } else {
    lines.push('売上: 日報未入力');
  }
  notifyAdmin_(lines.join('\n'));
  appendLog('info', 'system', '', '日次サマリー送信', dateStr);

  // 日報の task_completed / task_total を自動集計で更新
  if (row) updateDailyRow_(dateStr, { task_completed: fb.completed, task_total: fb.total });
  cleanupFiredKeys_();
}
