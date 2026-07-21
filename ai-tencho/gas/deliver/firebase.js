/**
 * deliver/firebase.js — Firebase Realtime Database への書き込み（REST）
 *
 * データ構造は §4-4。display/ はここに書かれた内容を購読して表示するだけ。
 * 認証は Database シークレット方式（プロパティ FIREBASE_DB_SECRET）。
 * サービスアカウント方式へ移行する場合はこのファイルだけ差し替えれば良い。
 */

function fbUrl_(path) {
  const base = requiredProp_('FIREBASE_DB_URL').replace(/\/$/, '');
  const secret = prop_('FIREBASE_DB_SECRET');
  return base + '/' + path + '.json' + (secret ? '?auth=' + secret : '');
}

/** path の値を丸ごと置き換える */
function fbSet_(path, value) {
  const res = withRetry_('firebase', function () {
    return UrlFetchApp.fetch(fbUrl_(path), {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(value),
      muteHttpExceptions: true
    });
  });
  if (res.getResponseCode() >= 300) throw new Error('Firebase PUT ' + path + ' HTTP ' + res.getResponseCode());
}

/** path 配下を部分更新する */
function fbUpdate_(path, obj) {
  const res = withRetry_('firebase', function () {
    return UrlFetchApp.fetch(fbUrl_(path), {
      method: 'patch',
      contentType: 'application/json',
      payload: JSON.stringify(obj),
      muteHttpExceptions: true
    });
  });
  if (res.getResponseCode() >= 300) throw new Error('Firebase PATCH ' + path + ' HTTP ' + res.getResponseCode());
}

function fbGet_(path) {
  const res = withRetry_('firebase', function () {
    return UrlFetchApp.fetch(fbUrl_(path), { muteHttpExceptions: true });
  });
  if (res.getResponseCode() >= 300) return null;
  return JSON.parse(res.getContentText());
}

/**
 * 現在の指示（store/current）を配信する。公開チャネルなので guard 通過済みであること。
 * @param {Object} msg { type, to, label, text, audio_url, rule_code }
 */
function publishCurrent_(msg) {
  msg.at = nowIso_();
  fbSet_('store/current', msg);
  appendLog('info', msg.type, msg.rule_code || '', msg.text, 'firebase:ok');
}

/** KPI の更新（store/kpi） */
function publishKpi_(kpi) {
  kpi.updated_at = nowIso_();
  fbSet_('store/kpi', kpi);
}

/** タスクの配信（store/tasks/<id>） */
function publishTask_(taskId, task) {
  fbSet_('store/tasks/' + taskId, task);
}
