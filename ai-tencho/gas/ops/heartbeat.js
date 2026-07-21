/**
 * ops/heartbeat.js — 死活監視（§8-5）
 *
 * - mainTick（5分毎）が heartbeat を Firebase に書く
 * - monitorHeartbeat（15分毎の別トリガー）が途絶を検知して東さんへ通知
 * - display 側でも同じ heartbeat を監視し、画面に「サーバー未接続」を出す
 *   （GASプロジェクト全体が死んだ場合の共倒れ対策。CHANGES_FROM_SPEC.md #4）
 */

const HEARTBEAT_STALE_MIN = 20;

function writeHeartbeat_() {
  fbSet_('store/heartbeat', nowIso_());
}

/** 15分毎トリガー。ハートビート途絶の検知。通知の連投は1時間に1回に抑える */
function monitorHeartbeat() {
  try {
    const hb = fbGet_('store/heartbeat');
    if (!hb) { alertHeartbeat_('heartbeat が読み取れません'); return; }
    const ageMin = (Date.now() - new Date(hb).getTime()) / 60000;
    if (ageMin > HEARTBEAT_STALE_MIN) {
      alertHeartbeat_('heartbeat が ' + Math.round(ageMin) + '分 途絶しています（最終: ' + hb + '）');
    }
  } catch (e) {
    alertHeartbeat_('死活監視自体が失敗: ' + e.message);
  }
}

function alertHeartbeat_(msg) {
  const props = PropertiesService.getScriptProperties();
  const last = Number(props.getProperty('last_hb_alert') || 0);
  if (Date.now() - last < 60 * 60 * 1000) return; // 1時間に1回まで
  props.setProperty('last_hb_alert', String(Date.now()));
  notifyAdmin_('【死活監視】' + msg);
  appendLog('error', 'system', '', '死活監視アラート: ' + msg, '');
}
