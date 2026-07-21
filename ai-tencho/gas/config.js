/**
 * config.js — 定数・スクリプトプロパティ・キルスイッチ
 *
 * 秘密情報（APIキー・トークン・ID類）はすべてスクリプトプロパティに置く。
 * コードに書かない。必要なプロパティの一覧は docs/SETUP.md を参照。
 */

const CONFIG = {
  TZ: 'Asia/Tokyo',

  // ---- 運用フェーズ（1〜6）。プロパティ PHASE で上書き ----
  DEFAULT_PHASE: 1,

  // ---- Claude ----
  // 仕様書の claude-sonnet-4-6 は存在しないIDのため claude-sonnet-5 を既定にした
  // （docs/CHANGES_FROM_SPEC.md #1）。プロパティ CLAUDE_MODEL で上書き可。
  CLAUDE_MODEL_DEFAULT: 'claude-sonnet-5',
  CLAUDE_MAX_TOKENS: 2048,
  CLAUDE_TIMEOUT_RETRIES: 3, // 指数バックオフの最大回数

  // ---- 判定閾値（%）。変更時は docs/RULES.md も更新すること ----
  THRESHOLD: {
    NORMAL_BAND: 5,   // ±5% は平常
    GOOD: 8,          // +8% 以上は好調
    NO_BLAME_GAP: 15  // 乖離15%以上は断定禁止（外部要因の可能性）
  },

  // ---- シート名 ----
  SHEET: {
    DAILY: 'daily',
    BASELINE: 'baseline',
    COST: 'cost',
    FEEDBACK: 'feedback',
    LOG: 'log',
    CONFIG: 'config',
    STAFF: 'staff' // 禁止語フィルタ用の在籍スタッフ名簿（氏名のみ）
  },

  // キルスイッチ：config シートのこのセルが STOP なら全発話停止（店長の手元）
  KILL_SWITCH_CELL: 'B1',

  // 深夜ジョブの営業日判定：この時刻（時）までは前日の営業日として扱う
  BUSINESS_DAY_ROLLOVER_HOUR: 6,

  // 気象庁エリアコード（未確定：OPEN_QUESTIONS #12。東京で仮置き）
  JMA_AREA_CODE_DEFAULT: '130000'
};

/** スクリプトプロパティを読む。無ければ fallback（未指定なら null） */
function prop_(key, fallback) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return (v === null || v === '') ? (fallback === undefined ? null : fallback) : v;
}

/** 必須プロパティ。無ければ例外（起動時チェック用） */
function requiredProp_(key) {
  const v = prop_(key);
  if (v === null) throw new Error('スクリプトプロパティ未設定: ' + key);
  return v;
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(requiredProp_('SPREADSHEET_ID'));
}

function getSheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('シートが存在しません: ' + name + '（setupSheets() を実行してください）');
  return sh;
}

/** キルスイッチ。毎実行の冒頭で必ず確認する */
function isKillSwitchOn() {
  try {
    const v = getSheet_(CONFIG.SHEET.CONFIG).getRange(CONFIG.KILL_SWITCH_CELL).getValue();
    return String(v).trim().toUpperCase() === 'STOP';
  } catch (e) {
    // シートすら読めない状態では発話しない（安全側に倒す）
    return true;
  }
}

function getPhase() {
  return Number(prop_('PHASE', CONFIG.DEFAULT_PHASE));
}

/** 承認モード：true の間は朝礼を前夜生成→東さん承認→翌朝配信（§8-4） */
function isApprovalMode() {
  return String(prop_('APPROVAL_MODE', 'true')).toLowerCase() !== 'false';
}

/** 営業日（朝6時までは前日扱い）を 'yyyy-MM-dd' で返す */
function businessDate(now) {
  const d = new Date(now ? now.getTime() : Date.now());
  if (d.getHours() < CONFIG.BUSINESS_DAY_ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd');
}

function nowIso_() {
  return Utilities.formatDate(new Date(), CONFIG.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * 外部API呼び出しの共通リトライ（指数バックオフ 2s→4s→8s、最大3回）
 * fn は UrlFetchApp を呼ぶ関数。5xx とネットワーク例外のみリトライする。
 */
function withRetry_(label, fn) {
  let lastErr = null;
  for (let i = 0; i < CONFIG.CLAUDE_TIMEOUT_RETRIES; i++) {
    try {
      const res = fn();
      const code = (typeof res.getResponseCode === 'function') ? res.getResponseCode() : 200;
      if (code < 500) return res;
      lastErr = new Error(label + ' HTTP ' + code);
    } catch (e) {
      lastErr = e;
    }
    Utilities.sleep(Math.pow(2, i + 1) * 1000);
  }
  throw lastErr;
}
