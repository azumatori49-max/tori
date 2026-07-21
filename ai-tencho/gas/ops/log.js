/**
 * ops/log.js — ログ基盤
 * すべての発話・配信・エラーを log シートに記録する（§12）。
 * ログ書き込み自体の失敗で本処理を止めない。
 */

const LOG_HEADER = ['at', 'level', 'kind', 'rule_code', 'text', 'result'];

/**
 * @param {string} level  'info' | 'warn' | 'error'
 * @param {string} kind   'brief' | 'alert' | 'task' | 'system' など
 * @param {string} ruleCode 状態コード（無ければ ''）
 * @param {string} text   生成文面 or メッセージ
 * @param {string} result 配信結果など
 */
function appendLog(level, kind, ruleCode, text, result) {
  try {
    getSheet_(CONFIG.SHEET.LOG).appendRow([
      nowIso_(), level, kind, ruleCode || '', String(text).slice(0, 2000), result || ''
    ]);
  } catch (e) {
    console.error('appendLog 失敗: ' + e.message);
  }
}

function logError_(e, context) {
  console.error((context || '') + ': ' + e.message + '\n' + (e.stack || ''));
  appendLog('error', 'system', '', (context || '') + ': ' + e.message, '');
}

/** 指定営業日のログ集計（日次サマリー用） */
function countLogs(dateStr) {
  const sh = getSheet_(CONFIG.SHEET.LOG);
  const values = sh.getDataRange().getValues();
  let speeches = 0, errors = 0;
  for (let i = 1; i < values.length; i++) {
    const at = String(values[i][0]);
    if (at.indexOf(dateStr) !== 0) continue;
    if (values[i][1] === 'error') errors++;
    if (['brief', 'alert', 'praise', 'check', 'task'].indexOf(values[i][2]) >= 0) speeches++;
  }
  return { speeches: speeches, errors: errors };
}
