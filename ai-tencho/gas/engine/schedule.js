/**
 * engine/schedule.js — タイムテーブル定義と発火判定（判定部は純関数）
 *
 * mainTick（5分トリガー）が dueJobs() を呼び、発火時刻を過ぎて未実行のジョブを実行する。
 * 「Phase」でジョブを制御する：開店から1ヶ月（Phase 1）は朝礼と数値表示のみ。
 * 時間帯指示・アラート発話は Phase 2 から（§10）。
 */

const TIMETABLE = [
  // 前夜のうちに翌日の朝礼を生成し、承認モードなら東さんへ承認依頼を送る（§8-4）
  { id: 'draft_brief',   at: '21:00', job: 'jobDraftMorningBrief',  phase: 1 },
  // 朝礼（開店15:00の30分前）
  { id: 'brief',         at: '14:30', job: 'jobDeliverBrief',       phase: 1 },
  // ピーク前の定型アナウンス（固定文言・キャッシュMP3）
  { id: 'peak_prep',     at: '17:00', job: 'jobPeakPrep',           phase: 2 },
  // 中間チェック：日報の途中経過ではなく前日確定値ベース（POSなしのため）。Phase 2 から
  { id: 'mid_check',     at: '20:00', job: 'jobMidCheck',           phase: 2 },
  // ラストオーダー前の定型アナウンス
  { id: 'last_order',    at: '22:30', job: 'jobLastOrder',          phase: 2 },
  // 閉店後の日次振り返り（営業日は前日扱い：businessDate() 参照）
  { id: 'daily_review',  at: '00:30', job: 'jobDailyReview',        phase: 1 },
  // 死活・実績の日次サマリーを東さんへ（§8-5）
  { id: 'daily_summary', at: '08:00', job: 'jobDailySummary',       phase: 1 }
];

/**
 * 発火すべきジョブを返す（純関数）。
 * @param {Date} now
 * @param {Array<string>} firedIds 当日すでに発火済みの id
 * @param {number} phase 現在の運用フェーズ
 * @param {Array} timetable 省略時は TIMETABLE
 * @returns {Array} 発火対象のジョブ定義
 */
function dueJobs(now, firedIds, phase, timetable) {
  timetable = timetable || (typeof TIMETABLE !== 'undefined' ? TIMETABLE : []);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return timetable.filter(function (j) {
    if (j.phase > phase) return false;
    if (firedIds.indexOf(j.id) >= 0) return false;
    const parts = j.at.split(':');
    const jobMin = Number(parts[0]) * 60 + Number(parts[1]);
    // 発火時刻を過ぎていて、かつ2時間以上経っていないもの（古い取りこぼしを深夜に鳴らさない）
    return nowMin >= jobMin && nowMin - jobMin < 120;
  });
}

// ---------- 発火済み管理（GAS 環境のみ） ----------

function firedKey_(now) {
  return 'fired_' + Utilities.formatDate(now, CONFIG.TZ, 'yyyy-MM-dd');
}

function getFiredIds_(now) {
  const raw = prop_(firedKey_(now), '[]');
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function markFired_(now, id) {
  const ids = getFiredIds_(now);
  if (ids.indexOf(id) < 0) ids.push(id);
  PropertiesService.getScriptProperties().setProperty(firedKey_(now), JSON.stringify(ids));
}

/** 古い fired_* プロパティの掃除（日次サマリー時に呼ぶ） */
function cleanupFiredKeys_() {
  const props = PropertiesService.getScriptProperties();
  const keys = props.getKeys();
  const keep = firedKey_(new Date());
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const keepY = firedKey_(yesterday);
  keys.forEach(function (k) {
    if (k.indexOf('fired_') === 0 && k !== keep && k !== keepY) props.deleteProperty(k);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { dueJobs, TIMETABLE };
}
