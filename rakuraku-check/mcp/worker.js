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
 */

const SECRET = "PASTE_LONG_RANDOM_SECRET_HERE"; // 例: IbR9...（README参照。必ず書き換える）
const SERVER_API_KEY = "PASTE_SERVER_API_KEY_HERE"; // サーバー用に新規作成したAPIキー
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
];

async function callTool(name, args) {
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
      description: "店舗巡回チェックのデータ（サマリー・ランキング・面談・CSV）を読み取り専用で返す。点数は項目5点満点・総合点100点満点、3点以下は要改善。" },
    servers: [{ url: `${url.origin}/gpt` }],
    paths: {
      "/summary": P("全店舗の現況サマリー（今月・先月の件数と平均点、ワーストランキング、アラート、面談リスク店舗）。まずこれを呼ぶ。", [], "getSummary"),
      "/ranking": P("指定月の店舗ランキング（総合点が低い順）", [["month", "YYYY-MM形式。省略時は今月"]], "getRanking"),
      "/checks": P("チェック一覧（日付・屋号・店舗・確認者・総合点）", [["month", "YYYY-MM形式"], ["store", "店舗名（部分一致）"]], "listChecks"),
      "/check": P("1回のチェックの詳細（全項目の点数・面談・宿題）", [["store", "店舗名（部分一致）", true], ["date", "YYYY-MM-DD形式（省略時は最新）"]], "getCheckDetail"),
      "/interviews": P("店長面談の記録一覧（新しい順）", [["store", "店舗名（部分一致）"], ["limit", "件数上限（既定10）"]], "getInterviews"),
      "/csv": P("全チェックデータをCSVで取得（分析用）", [["month", "YYYY-MM形式"]], "getCsv"),
    },
  };
  return new Response(JSON.stringify(doc, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8" } });
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
