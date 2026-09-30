/*
 * らくらく臨店チェック MCPサーバー（Cloudflare Worker・1ファイル）
 *
 * ClaudeやChatGPTなどのAIチャットから、臨店チェックのデータ
 * （チェック結果・月別ランキング・面談内容・アラート）を直接参照できるようにする。
 * データは既存のFirestore（rakuraku-check プロジェクト）を読み取り専用で参照する。
 * 書き込みは一切しない。
 *
 * セットアップ手順は同じフォルダの README.md を参照。
 * ①下の SECRET を長いランダム文字列に書き換える
 * ②SERVER_API_KEY にサーバー用のAPIキーを入れる（リファラー制限なし・
 *   Identity Toolkit API と Cloud Firestore API だけに制限したキーを新規作成）
 * ③Cloudflare Workers のダッシュボードにこのファイルを貼り付けてデプロイ
 * ④（任意）経営指標（KPI・売上・FL）を使う場合は、下の METRICS_KEY / TEAM_NOTE_ORIGIN /
 *   KPI_SHEET_ID も書き換える（README の「経営指標を有効にする」参照）。
 *   "PASTE_" のままの項目は「未設定」として扱われ、その部分だけが空になる（他は動く）
 */

const SECRET = "PASTE_LONG_RANDOM_SECRET_HERE"; // 例: IbR9...（README参照。必ず書き換える）
const SERVER_API_KEY = "PASTE_SERVER_API_KEY_HERE"; // サーバー用に新規作成したAPIキー
// ---- 経営指標API（GET /metrics）用の設定。SECRET とは別の値にすること ----
const METRICS_KEY = "PASTE_METRICS_KEY_HERE"; // アプリが /metrics を読むための閲覧キー（SECRETとは別物）
const TEAM_NOTE_ORIGIN = "PASTE_TEAM_NOTE_ORIGIN_HERE"; // 売上・FLの取得元。例 https://xxxx.example.site（末尾スラッシュ無し）
const KPI_SHEET_ID = "PASTE_KPI_SHEET_ID_HERE"; // KPIスプレッドシートのID（URLの /d/ と /edit の間）
const KPI_TAB_GIDS = {}; // 任意。"YYYY-MM" → タブのgid。例 {"2026-09": "123456789"}。空でも名前で探す
const PROJECT_ID = "rakuraku-check";
const REFERER = "https://rakuraku-check.com/";

// 項目ID→表示名（アプリ側 CHECK_CATS と対応。項目を追加したらここにも足す）
const ITEM_NAMES = {
  lighting: "照明・看板・提灯・周辺POP", entrance: "店舗入口",
  tables: "テーブル", condiments: "テーブルコンディメンツ", chairs: "椅子", hall_floor: "ホール・床",
  fridge: "冷蔵・冷凍管理", cutting_board: "まな板", knife: "包丁", duster: "ダスター・衛生ルール",
  fryer: "フライヤー", stove: "コンロ", garbage: "ゴミ置き場・ゴミ箱",
  peak: "ピーク帯・オペレーション力", service: "接客・笑顔", vitality: "スタッフの活気",
  quality: "商品品質管理", product_control: "商品管理", tequila: "テキーラタイム",
  uniform: "ユニフォーム", greeting: "挨拶", register: "レジ周り", toilet: "トイレチェック",
};
const INTERVIEW_LABELS = {
  q1: "最近良かったこと", q2: "人間関係", q3: "人員数・スタッフ育成",
  q4: "設備・備品の困りごと", q5: "その他の課題",
};

/* ---------- Firebase 匿名認証（読み取り用トークン） ---------- */
let cachedToken = null, tokenAt = 0;
async function idToken() {
  if (cachedToken && Date.now() - tokenAt < 45 * 60 * 1000) return cachedToken;
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${SERVER_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json", "Referer": REFERER }, body: "{}" });
  if (!r.ok) throw new Error(`Firebase認証に失敗 (${r.status}): ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  cachedToken = j.idToken; tokenAt = Date.now();
  return cachedToken;
}

/* ---------- Firestore REST（inspections を全件読み取り） ---------- */
function decodeValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
  return null;
}
function decodeFields(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields)) o[k] = decodeValue(v);
  return o;
}
let cachedChecks = null, checksAt = 0;
async function fetchChecks() {
  if (cachedChecks && Date.now() - checksAt < 60 * 1000) return cachedChecks; // 1分キャッシュ
  const token = await idToken();
  const out = [];
  let pageToken = "";
  for (let page = 0; page < 10; page++) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/inspections?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const r = await fetch(url, { headers: { "Authorization": `Bearer ${token}`, "Referer": REFERER } });
    if (!r.ok) throw new Error(`Firestore読み取りに失敗 (${r.status}): ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    for (const d of j.documents || []) out.push(decodeFields(d.fields || {}));
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  out.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  cachedChecks = out; checksAt = Date.now();
  return out;
}

/* ---------- 集計ヘルパー（アプリ側のロジックと同じ考え方） ---------- */
const ym = d => String(d || "").slice(0, 7);
const completed = list => list.filter(i => i.completedAt && !i.provisional);
function score5(check, itemId) {
  const a = check.answers && check.answers[itemId];
  const v = a && a.evals && a.evals.main;
  const m = /^([1-5])点$/.exec(String(v || ""));
  return m ? Number(m[1]) : null;
}
function ranking(list, month) {
  const inMonth = completed(list).filter(i => !month || ym(i.date) === month);
  const by = {};
  for (const i of inMonth) {
    const k = i.store;
    if (!by[k] || (i.date + (i.completedAt || "")) > (by[k].date + (by[k].completedAt || ""))) by[k] = i;
  }
  return Object.values(by)
    .map(i => ({ store: i.store, brand: i.brand || "", score: i.totalScore, date: i.date }))
    .sort((a, b) => a.score - b.score || a.store.localeCompare(b.store));
}
function alerts(list) {
  // 店舗×項目で「3点以下」が5回以上になったものを列挙
  const done = completed(list);
  const rows = [];
  const stores = [...new Set(done.map(i => i.store))];
  for (const s of stores) {
    const checks = done.filter(i => i.store === s);
    for (const [id, name] of Object.entries(ITEM_NAMES)) {
      const low = checks.filter(c => { const v = score5(c, id); return v != null && v <= 3; }).length;
      if (low >= 5) rows.push({ store: s, item: name, lowCount: low });
    }
  }
  return rows.sort((a, b) => b.lowCount - a.lowCount);
}
function interviewsOf(check) {
  const iv = (check.pdca && check.pdca.interview) || {};
  const qa = Object.entries(INTERVIEW_LABELS)
    .map(([k, label]) => ({ label, text: String(iv[k] || "").trim() }))
    .filter(x => x.text);
  return { interviewee: iv.interviewee || "", qa, ai: iv.ai || null };
}
function csvEsc(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
function buildCsv(list, month) {
  const ids = Object.keys(ITEM_NAMES);
  const head = ["日付", "屋号", "店舗", "確認者", "総合点", "状態", ...ids.map(id => ITEM_NAMES[id]),
    ...Object.values(INTERVIEW_LABELS).map(l => "面談：" + l)];
  const rows = [head];
  for (const i of list.filter(x => x.completedAt && (!month || ym(x.date) === month))) {
    const iv = (i.pdca && i.pdca.interview) || {};
    rows.push([i.date, i.brand || "", i.store, i.inspector, i.totalScore,
      i.provisional ? "一時保存" : "完了",
      ...ids.map(id => { const s = score5(i, id); return s == null ? "" : s; }),
      ...Object.keys(INTERVIEW_LABELS).map(k => String(iv[k] || "").trim())]);
  }
  return rows.map(r => r.map(csvEsc).join(",")).join("\n");
}

/* ---------- 経営指標（KPI・売上・FL） ----------
 * 売上・FL：TEAM NOTE の公開API（GET {TEAM_NOTE_ORIGIN}/api/daily）から店舗ごとの日報行を作る。
 * KPI：Googleスプレッドシート（リンク共有）の月別タブから A列=店名・B列=点数 を読む。
 * どちらかが失敗しても、もう一方は返す（失敗した側は null＋errors に理由）。
 * 結果は 5分だけメモリに保持（失敗を含む場合は60秒で再試行）。 */
const METRICS_ALLOWED_ORIGINS = ["https://rakuraku-check.com", "https://www.rakuraku-check.com", "https://azumatori49-max.github.io"];
const METRICS_TTL_MS = 5 * 60 * 1000;       // 正常時のキャッシュ
const METRICS_RETRY_MS = 60 * 1000;         // errors を含む時のキャッシュ（一時的な失敗からすぐ復帰するため短く）
const METRICS_TIMEOUT_MS = 20 * 1000;       // 外部取得1回あたりの上限
const KPI_MONTHS_BACK = 3;                  // 今月＋前3か月
const KPI_UNREADABLE = "KPIシートを取得できません（共有設定・シートIDを確認）";

const isUnset = v => typeof v !== "string" || !v.trim() || v.includes("PASTE_");
const isNum = v => typeof v === "number" && Number.isFinite(v);
const numOrNull = v => (isNum(v) ? v : null);
const strOrNull = v => (typeof v === "string" ? v : null);
const sumOrNull = (a, b) => (isNum(a) && isNum(b) ? a + b : null);
const failText = e => (e && e.name === "TimeoutError" ? "タイムアウト" : "通信エラー"); // URLは応答に載せない

function jstMonth(ms = Date.now()) { return new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 7); }
function kpiMonthList() {
  const [y, m] = jstMonth().split("-").map(Number);
  return Array.from({ length: KPI_MONTHS_BACK + 1 }, (_, i) => {
    const t = y * 12 + (m - 1) - i;
    return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, "0")}`;
  });
}
// タブ名「{期}期{月}月」。期＝西暦年-2010（5月始まり：4月以前は前年扱いで -1）。末尾空白付きも試す
function kpiTabNames(month) {
  const [y, m] = month.split("-").map(Number);
  const base = `${m >= 5 ? y - 2010 : y - 2011}期${m}月`;
  return [base, base + " "];
}
// 店名の比較用キー（表記ゆれ・改称を吸収。日報とKPIの突き合わせ、絞り込みで共通に使う）
function storeKey(name) {
  return String(name == null ? "" : name).normalize("NFKC").replace(/\s/g, "").toLowerCase()
    .replace(/^(魚と鶏ヤロー|魚鶏|すし鳥商店)/, "すし鳥商店")
    .replace(/店$/, "")
    .replace(/^鶏ヤロー渋谷店道玄坂$/, "鶏ヤロー渋谷道玄坂")
    .replace(/^鶏ヤロー新橋$/, "すし鳥商店新橋")
    .replace(/^鶏ヤロー立川南口$/, "鶏ヤロー立川")
    .replace(/^すし鳥商店立川$/, "鶏ヤロー立川北口");
}

/* CSV（引用符・引用符内の改行/カンマ/"" に対応） */
function parseCsvRows(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function parseScore(v) { // 全角・カンマ・空白・末尾の「点」を許容。数値でなければ null
  const s = String(v == null ? "" : v).normalize("NFKC").replace(/[\s,]/g, "").replace(/点$/, "");
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
}
// A列=店名・B列=点数。点数が数値でない行（ヘッダー等）、店名が空／平均・合計などの行は捨てる
function parseKpiCsv(text) {
  const out = [];
  for (const r of parseCsvRows(String(text == null ? "" : text).replace(/^﻿/, ""))) {
    const store = String(r[0] == null ? "" : r[0]).trim();
    if (!store || /^(平均|合計|全体|全社|total|average)/i.test(store.normalize("NFKC"))) continue;
    const score = parseScore(r[1]);
    if (score == null) continue;
    out.push({ store, score });
  }
  return out;
}

/* 日報API → 店舗ごとの compact 行（history は巨大なので捨てる） */
function compactDaily(item) {
  const s = item && item.store;
  if (!s || typeof s !== "object" || typeof s.store !== "string" || !s.store.trim()) return null;
  const v = s.values && typeof s.values === "object" ? s.values : {};
  return {
    id: strOrNull(s.id), store: s.store, branch: strOrNull(s.branch), brand: strOrNull(s.brand),
    area: strOrNull(s.area), asOf: strOrNull(s.asOf),
    sales: numOrNull(v.sales), budget: numOrNull(v.budget), cumulativeBudget: numOrNull(v.cumulativeBudget),
    pace: numOrNull(v.pace), achievement: numOrNull(v.achievement), yoy: numOrNull(v.yoy),
    cost: numOrNull(v.cost), costRate: numOrNull(v.costRate),
    laborAmount: numOrNull(v.laborAmount), laborRate: numOrNull(v.laborRate),
    fl: sumOrNull(v.costRate, v.laborRate),
    costForecast: numOrNull(v.costForecast), laborForecast: numOrNull(v.laborForecast),
    flForecast: sumOrNull(v.costForecast, v.laborForecast),
    salesPerHour: numOrNull(v.salesPerHour), customerSpend: numOrNull(v.customerSpend), customers: numOrNull(v.customers),
    updatedAt: numOrNull(item.updatedAt), error: strOrNull(item.error),
  };
}
async function fetchDailyPart() {
  if (isUnset(TEAM_NOTE_ORIGIN)) return { daily: null, month: null, error: "売上・FLの取得元（TEAM_NOTE_ORIGIN）が未設定です" };
  const origin = String(TEAM_NOTE_ORIGIN).trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/]+/i.test(origin) || /\s/.test(origin))
    return { daily: null, month: null, error: "TEAM_NOTE_ORIGIN の形式が正しくありません（https:// から始まるURLを入れてください）" };
  let r;
  try { r = await fetch(`${origin}/api/daily`, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(METRICS_TIMEOUT_MS) }); }
  catch (e) { return { daily: null, month: null, error: `日報APIを取得できません（${failText(e)}）` }; }
  if (!r.ok) return { daily: null, month: null, error: `日報APIを取得できません (${r.status})` };
  let j;
  try { j = await r.json(); } catch { j = null; }
  if (!j || !Array.isArray(j.items)) return { daily: null, month: null, error: "日報APIの形式が想定と異なります" };
  const rows = j.items.map(compactDaily).filter(Boolean);
  const stamps = j.items.map(i => i && i.updatedAt).filter(t => isNum(t) && t > 0);
  return {
    daily: { rows, upstreamUpdatedAt: stamps.length ? Math.max(...stamps) : null },
    month: typeof j.month === "string" && /^\d{4}-\d{2}$/.test(j.month) ? j.month : null,
    error: null,
  };
}

/* KPIシート：月ごとに CSV を取る（gid指定 → 無ければ／失敗したらタブ名2通り） */
async function fetchKpiMonth(month) {
  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(String(KPI_SHEET_ID).trim())}`;
  const urls = [];
  const gid = KPI_TAB_GIDS && KPI_TAB_GIDS[month];
  if (gid != null && String(gid).trim() !== "") urls.push(`${base}/export?format=csv&gid=${encodeURIComponent(String(gid).trim())}`);
  for (const name of kpiTabNames(month)) urls.push(`${base}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`);
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(METRICS_TIMEOUT_MS) });
      if (!r.ok) continue;
      const text = await r.text();
      if (!text || text.trimStart().startsWith("<")) continue; // ログイン画面などのHTML＝取得失敗
      return parseKpiCsv(text);
    } catch { /* 次の候補へ */ }
  }
  return null; // 過去月でタブが無いのは普通
}
async function fetchKpiPart() {
  if (isUnset(KPI_SHEET_ID)) return { kpi: null, error: "KPIシートのID（KPI_SHEET_ID）が未設定です" };
  const months = kpiMonthList();
  const got = await Promise.all(months.map(m => fetchKpiMonth(m)));
  const kpi = {};
  months.forEach((m, i) => { if (got[i]) kpi[m] = got[i]; });
  return Object.keys(kpi).length ? { kpi, error: null } : { kpi: null, error: KPI_UNREADABLE };
}

let metricsCache = null, metricsAt = 0;
async function getMetrics() {
  const ttl = metricsCache && metricsCache.errors.length ? METRICS_RETRY_MS : METRICS_TTL_MS;
  if (metricsCache && Date.now() - metricsAt < ttl) return metricsCache;
  // daily と kpi は互いに失敗を隔離して並列取得（どちらも例外は投げない作りだが念のため握りつぶす）
  const [d, k] = await Promise.all([
    fetchDailyPart().catch(() => ({ daily: null, month: null, error: "日報の取得中に予期しないエラーが起きました" })),
    fetchKpiPart().catch(() => ({ kpi: null, error: KPI_UNREADABLE })),
  ]);
  metricsCache = {
    fetchedAt: new Date().toISOString(),
    month: d.month, daily: d.daily, kpi: k.kpi,
    errors: [d.error, k.error].filter(Boolean),
  };
  metricsAt = Date.now();
  return metricsCache;
}

/* ---------- MCPツール定義 ---------- */
const TOOLS = [
  { name: "get_summary",
    description: "全店舗の現況サマリー：今月・先月のチェック数と平均総合点、今月のワーストランキング、アラート項目（3点以下が5回以上）、面談AIリスクの高い店舗。まずこれを呼ぶとよい。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_ranking",
    description: "指定した月の店舗ランキング（総合点が低い順）。month省略時は今月。",
    inputSchema: { type: "object", properties: { month: { type: "string", description: "YYYY-MM形式。省略時は今月" } }, additionalProperties: false } },
  { name: "list_checks",
    description: "チェック（臨店）の一覧。日付・屋号・店舗・確認者・総合点。monthやstoreで絞り込み可能。",
    inputSchema: { type: "object", properties: {
      month: { type: "string", description: "YYYY-MM形式" },
      store: { type: "string", description: "店舗名（部分一致）" } }, additionalProperties: false } },
  { name: "get_check_detail",
    description: "1回のチェックの詳細（全項目の5段階点・面談内容・宿題）。storeは必須、dateを省略すると最新のチェックを返す。",
    inputSchema: { type: "object", properties: {
      store: { type: "string", description: "店舗名（部分一致）" },
      date: { type: "string", description: "YYYY-MM-DD形式（省略時は最新）" } },
      required: ["store"], additionalProperties: false } },
  { name: "get_interviews",
    description: "店長面談の記録一覧（新しい順）。storeで絞り込み可能。",
    inputSchema: { type: "object", properties: {
      store: { type: "string", description: "店舗名（部分一致）" },
      limit: { type: "number", description: "件数上限（既定10）" } }, additionalProperties: false } },
  { name: "get_csv",
    description: "全チェックデータをCSV形式で取得（分析・集計用。写真は含まない）。monthで月指定可能。",
    inputSchema: { type: "object", properties: { month: { type: "string", description: "YYYY-MM形式" } }, additionalProperties: false } },
  { name: "get_store_metrics",
    description: "店舗ごとの経営指標：日報の売上・予算累計・達成率・着地ペース・原価率(F)・人件費率(L)・FL率・着地予想と、KPI点数（月別・直近4か月）。storeで絞り込み（部分一致・表記ゆれ吸収）、monthでKPIの月を指定（日報は当月分のみ）。率は%表記。",
    inputSchema: { type: "object", properties: {
      store: { type: "string", description: "店舗名（部分一致）。省略時は全店舗" },
      month: { type: "string", description: "YYYY-MM形式。省略時はKPIを取得できた全月" } }, additionalProperties: false } },
];

const pct = v => (isNum(v) ? `${(v * 100).toFixed(1)}%` : null);
const isoOrNull = ms => (isNum(ms) && ms > 0 ? new Date(ms).toISOString() : null);
async function storeMetricsTool(args) {
  const month = args && args.month ? String(args.month).trim() : "";
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { error: "monthはYYYY-MM形式で指定してください" };
  const rawStore = args && args.store ? String(args.store).trim() : "";
  const q = storeKey(rawStore);
  const hit = (...names) => !q || names.some(n => n && storeKey(n).includes(q));
  const m = await getMetrics();
  const memo = [];

  // 日報は「当月分のみ」。別の月を指定されたら売上・FLは出さない（別月の数字を混ぜない）
  const dailyOk = !!m.daily && (!month || !m.month || month === m.month);
  if (m.daily && !dailyOk) memo.push(`日報（売上・FL）は${m.month}分のみです。${month}の売上・FLは出せません`);
  const dailyRows = dailyOk ? m.daily.rows.filter(r => hit(r.store, r.branch)) : [];

  // KPI（月ごと）を店名キーでまとめる
  const kpiMonths = Object.keys(m.kpi || {}).filter(k => !month || k === month);
  if (month && m.kpi && !kpiMonths.length) memo.push(`KPIの${month}分は取得できませんでした（直近${KPI_MONTHS_BACK + 1}か月のみ対象・タブが無い場合も同様）`);
  const kpiBy = new Map(); // key → { name, scores: { "YYYY-MM": 点 } }
  for (const mo of kpiMonths) {
    for (const r of m.kpi[mo]) {
      const k = storeKey(r.store);
      if (!kpiBy.has(k)) kpiBy.set(k, { name: r.store, scores: {} });
      const e = kpiBy.get(k);
      if (!(mo in e.scores)) e.scores[mo] = r.score;
    }
  }

  const stores = [];
  const used = new Set();
  for (const r of dailyRows) {
    const k = storeKey(r.store);
    used.add(k);
    const kp = kpiBy.get(k);
    stores.push({
      店舗: r.store, 屋号: r.brand, エリア: r.area, 参照日: r.asOf,
      売上: r.sales, 予算累計: r.cumulativeBudget, 達成率: pct(r.achievement), 着地ペース: r.pace, 前年比: pct(r.yoy),
      原価率: pct(r.costRate), 人件費率: pct(r.laborRate), FL率: pct(r.fl),
      着地予想: { 原価率: pct(r.costForecast), 人件費率: pct(r.laborForecast), FL率: pct(r.flForecast) },
      客数: r.customers, 客単価: r.customerSpend, 人時売上: r.salesPerHour,
      日報更新: isoOrNull(r.updatedAt), 日報エラー: r.error,
      KPI点数: kp ? kp.scores : {},
    });
  }
  for (const [k, e] of [...kpiBy].sort((a, b) => a[1].name.localeCompare(b[1].name, "ja"))) {
    if (used.has(k) || !hit(e.name)) continue; // 日報の行に結合済み／絞り込み対象外
    stores.push({ 店舗: e.name, KPI点数: e.scores });
  }

  const out = {
    日報の対象月: m.month,
    日報の最終更新: m.daily ? isoOrNull(m.daily.upstreamUpdatedAt) : null,
    KPIの月: kpiMonths,
    説明: "売上・予算累計・着地ペースは円。率は%（FL率＝原価率＋人件費率）。KPI点数は月別。",
    件数: stores.length,
    店舗: stores,
  };
  if (memo.length) out.メモ = memo;
  if (m.errors.length) out.取得エラー = m.errors;
  if (!stores.length && rawStore) out.error = `店舗「${rawStore}」の経営指標が見つかりません`;
  return out;
}

async function callTool(name, args) {
  if (name === "get_store_metrics") return storeMetricsTool(args || {}); // Firestore（臨店データ）は使わない
  const list = await fetchChecks();
  const now = new Date().toISOString().slice(0, 7);
  const prev = (() => { const [y, m] = now.split("-").map(Number); const t = y * 12 + m - 2; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, "0")}`; })();
  if (name === "get_summary") {
    const done = completed(list);
    const cur = done.filter(i => ym(i.date) === now), pre = done.filter(i => ym(i.date) === prev);
    const avg = a => a.length ? Math.round(a.reduce((s, i) => s + (i.totalScore || 0), 0) / a.length) : null;
    const risky = done.map(i => ({ i, ai: i.pdca && i.pdca.interview && i.pdca.interview.ai }))
      .filter(x => x.ai && (x.ai.level === "高" || x.ai.level === "中"))
      .map(x => ({ store: x.i.store, date: x.i.date, risk: x.ai.risk, level: x.ai.level, summary: x.ai.summary || "" }));
    return {
      今月: { 月: now, チェック数: cur.length, 平均総合点: avg(cur) },
      先月: { 月: prev, チェック数: pre.length, 平均総合点: avg(pre) },
      今月のランキング_低い順: ranking(list, now),
      アラート項目: alerts(list),
      面談リスクの高い店舗: risky,
    };
  }
  if (name === "get_ranking") return { 月: args.month || now, ランキング_低い順: ranking(list, args.month || now) };
  if (name === "list_checks") {
    return list.filter(i => i.completedAt
      && (!args.month || ym(i.date) === args.month)
      && (!args.store || String(i.store || "").includes(args.store)))
      .map(i => ({ date: i.date, brand: i.brand || "", store: i.store, inspector: i.inspector,
        totalScore: i.totalScore, provisional: !!i.provisional }));
  }
  if (name === "get_check_detail") {
    const hits = list.filter(i => i.completedAt && String(i.store || "").includes(args.store)
      && (!args.date || i.date === args.date));
    const c = hits[hits.length - 1];
    if (!c) return { error: `店舗「${args.store}」のチェックが見つかりません` };
    const items = {};
    for (const [id, nm] of Object.entries(ITEM_NAMES)) {
      const a = c.answers && c.answers[id];
      if (!a) continue;
      items[nm] = { 点数: score5(c, id), 評価: (a.evals && a.evals.main) || null };
    }
    return { date: c.date, brand: c.brand || "", store: c.store, inspector: c.inspector,
      totalScore: c.totalScore, provisional: !!c.provisional, 項目: items,
      面談: interviewsOf(c), 宿題: c.homework || [], 自動タスク: c.autoTasks || [] };
  }
  if (name === "get_interviews") {
    const rows = list.filter(i => i.completedAt && (!args.store || String(i.store || "").includes(args.store)))
      .map(i => ({ date: i.date, store: i.store, ...interviewsOf(i) }))
      .filter(r => r.qa.length)
      .reverse().slice(0, args.limit || 10);
    return rows;
  }
  if (name === "get_csv") return buildCsv(list, args.month || null);
  throw new Error(`unknown tool: ${name}`);
}

/* ---------- ChatGPT カスタムGPT（Actions）用の REST API ----------
 * GPTs の Actions は MCP ではなく REST + OpenAPI を使うため、同じデータを
 * GET /gpt/summary などで返す。認証は Authorization: Bearer <SECRET>。
 * OpenAPI 定義は GET /gpt/openapi.json（公開・秘密情報は含まない）。 */
async function handleGpt(request, url) {
  if (SECRET.includes("PASTE_") || SERVER_API_KEY.includes("PASTE_"))
    return new Response("Server not configured (SECRET / SERVER_API_KEY)", { status: 500 });
  const auth = request.headers.get("Authorization") || "";
  if (auth !== `Bearer ${SECRET}`)
    return new Response(JSON.stringify({ error: "認証エラー：APIキー（Bearer）が正しくありません" }),
      { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } });
  if (request.method !== "GET") return new Response(null, { status: 405 });
  const q = url.searchParams, path = url.pathname.slice("/gpt/".length);
  const opt = k => q.get(k) || undefined;
  try {
    let out;
    if (path === "summary") out = await callTool("get_summary", {});
    else if (path === "ranking") out = await callTool("get_ranking", { month: opt("month") });
    else if (path === "checks") out = await callTool("list_checks", { month: opt("month"), store: opt("store") });
    else if (path === "check") {
      if (!q.get("store")) return new Response(JSON.stringify({ error: "storeパラメータは必須です" }), { status: 400, headers: { "Content-Type": "application/json; charset=utf-8" } });
      out = await callTool("get_check_detail", { store: q.get("store"), date: opt("date") });
    }
    else if (path === "interviews") out = await callTool("get_interviews", { store: opt("store"), limit: q.get("limit") ? Number(q.get("limit")) : undefined });
    else if (path === "metrics") out = await callTool("get_store_metrics", { store: opt("store"), month: opt("month") });
    else if (path === "csv") return new Response(await callTool("get_csv", { month: opt("month") }), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    else return new Response("Not found", { status: 404 });
    return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
}
function gptOpenapi(url) {
  const P = (summary, params, opId) => ({
    get: { operationId: opId, summary,
      parameters: params.map(([name, desc, required]) => ({
        name, in: "query", required: !!required, description: desc, schema: { type: "string" } })),
      responses: { "200": { description: "OK" } } },
  });
  const doc = {
    openapi: "3.1.0",
    info: { title: "らくらく臨店チェック データAPI", version: "1.0.0",
      description: "店舗巡回チェックのデータ（サマリー・ランキング・面談・CSV）と、店舗ごとの経営指標（売上・FL・KPI）を読み取り専用で返す。点数は項目5点満点・総合点100点満点、3点以下は要改善。" },
    servers: [{ url: `${url.origin}/gpt` }],
    paths: {
      "/summary": P("全店舗の現況サマリー（今月・先月の件数と平均点、ワーストランキング、アラート、面談リスク店舗）。まずこれを呼ぶ。", [], "getSummary"),
      "/ranking": P("指定月の店舗ランキング（総合点が低い順）", [["month", "YYYY-MM形式。省略時は今月"]], "getRanking"),
      "/checks": P("チェック一覧（日付・屋号・店舗・確認者・総合点）", [["month", "YYYY-MM形式"], ["store", "店舗名（部分一致）"]], "listChecks"),
      "/check": P("1回のチェックの詳細（全項目の点数・面談・宿題）", [["store", "店舗名（部分一致）", true], ["date", "YYYY-MM-DD形式（省略時は最新）"]], "getCheckDetail"),
      "/interviews": P("店長面談の記録一覧（新しい順）", [["store", "店舗名（部分一致）"], ["limit", "件数上限（既定10）"]], "getInterviews"),
      "/csv": P("全チェックデータをCSVで取得（分析用）", [["month", "YYYY-MM形式"]], "getCsv"),
      "/metrics": P("店舗ごとの経営指標（日報の売上・達成率・原価率・人件費率・FL率・着地予想と、KPI点数の月別）。storeで絞り込み。率は%表記", [["store", "店舗名（部分一致・表記ゆれ吸収）"], ["month", "YYYY-MM形式（KPIの月。日報は当月分のみ）"]], "getStoreMetrics"),
    },
  };
  return new Response(JSON.stringify(doc, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}

/* ---------- 経営指標API（アプリ用）：GET /metrics ----------
 * 認証：Authorization: Bearer <METRICS_KEY>（SECRET・/gpt の認証とは独立）。
 * ブラウザ（アプリ）から直接読むので CORS を付ける。許可するのは METRICS_ALLOWED_ORIGINS に
 * 完全一致するオリジンだけ。エラー応答にも同じ CORS を付け、ブラウザが原因を読めるようにする。 */
function safeEqual(a, b) { // 長さ以外は一定時間で比較
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0, n = Math.max(a.length, b.length); i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
async function handleMetrics(request) {
  const cors = { "Vary": "Origin", "Cache-Control": "no-store" };
  const origin = request.headers.get("Origin");
  if (origin && METRICS_ALLOWED_ORIGINS.includes(origin)) cors["Access-Control-Allow-Origin"] = origin;
  const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj),
    { status, headers: { ...cors, ...extra, "Content-Type": "application/json; charset=utf-8" } });
  if (request.method === "OPTIONS") // プリフライト（Authorization は付かないので認証しない）
    return new Response(null, { status: 204, headers: { ...cors,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400" } });
  if (request.method !== "GET") return json({ error: "GETのみ対応しています" }, 405, { "Allow": "GET, OPTIONS" });
  // 未設定の間は「PASTE_…」という文字列そのものを鍵として通してしまわないよう、認証より先に弾く
  if (isUnset(METRICS_KEY)) return json({ error: "サーバー未設定です（METRICS_KEY）" }, 500);
  if (!safeEqual(request.headers.get("Authorization") || "", `Bearer ${METRICS_KEY}`))
    return json({ error: "認証エラー：閲覧キー（Bearer）が正しくありません" }, 401);
  try {
    const m = await getMetrics();
    return json({ fetchedAt: m.fetchedAt, month: m.month, daily: m.daily, kpi: m.kpi, errors: m.errors });
  } catch (e) {
    return json({ error: "経営指標を組み立てられませんでした" }, 500);
  }
}

/* ---------- MCP（JSON-RPC over Streamable HTTP） ---------- */
function rpcResult(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message) { return { jsonrpc: "2.0", id, error: { code, message } }; }
async function handleRpc(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: (params && params.protocolVersion) || "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "rakuraku-check-mcp", version: "1.0.0" },
      instructions: "らくらく臨店チェック（店舗巡回アプリ）のデータを参照できます。まず get_summary で全体像を取得し、詳細は他のツールで絞り込んでください。点数は項目が5点満点・総合点が100点満点、3点以下は要改善です。",
    });
  }
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools: TOOLS });
  if (method === "tools/call") {
    try {
      const out = await callTool(params.name, params.arguments || {});
      const text = typeof out === "string" ? out : JSON.stringify(out, null, 1);
      return rpcResult(id, { content: [{ type: "text", text }], isError: false });
    } catch (e) {
      return rpcResult(id, { content: [{ type: "text", text: `エラー: ${e.message || e}` }], isError: true });
    }
  }
  if (String(method || "").startsWith("notifications/")) return null; // 通知は応答不要
  return rpcError(id, -32601, `method not found: ${method}`);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // ChatGPT カスタムGPT（Actions）用の入り口
    if (url.pathname === "/gpt/openapi.json") return gptOpenapi(url);
    if (url.pathname.startsWith("/gpt/")) return handleGpt(request, url);
    // アプリ用の経営指標API（KPI・売上・FL）。他の認証とは独立
    if (url.pathname === "/metrics") return handleMetrics(request);
    // 認証：URLパスの末尾セグメントが SECRET と一致すること
    if (url.pathname !== `/mcp/${SECRET}`) return new Response("Not found", { status: 404 });
    if (SECRET.includes("PASTE_") || SERVER_API_KEY.includes("PASTE_"))
      return new Response("Server not configured (SECRET / SERVER_API_KEY)", { status: 500 });
    if (request.method === "GET") return new Response(null, { status: 405 }); // SSEストリームは未提供（JSON応答のみ）
    if (request.method !== "POST") return new Response(null, { status: 405 });
    let body;
    try { body = await request.json(); } catch { return new Response(JSON.stringify(rpcError(null, -32700, "parse error")), { status: 400, headers: { "Content-Type": "application/json" } }); }
    const messages = Array.isArray(body) ? body : [body];
    const replies = [];
    for (const m of messages) {
      const r = await handleRpc(m);
      if (r) replies.push(r);
    }
    if (!replies.length) return new Response(null, { status: 202 });
    const payload = Array.isArray(body) ? replies : replies[0];
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  },
};
