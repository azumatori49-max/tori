/**
 * main.js — トリガーのエントリポイントとジョブの実装（オーケストレーション）
 *
 * トリガー構成（setupTriggers() で作成）:
 *  - mainTick        5分毎   … キルスイッチ確認 → heartbeat → タイムテーブル発火 → KPI更新
 *  - monitorHeartbeat 15分毎 … 死活監視（ops/heartbeat.js）
 *  - checkRuleDemotion 週1   … 実施率低下の検知（ops/feedback.js）
 *  - doPost          WebApp  … LINE Webhook
 */

// ================= エントリポイント =================

function mainTick() {
  try {
    // キルスイッチ（§8-3）。毎回の実行冒頭で必ず確認する
    if (isKillSwitchOn()) {
      try { fbSet_('store/kill_switch', true); } catch (e) { /* 停止表示も出せないだけ */ }
      return;
    }
    fbSet_('store/kill_switch', false);
    writeHeartbeat_();

    const now = new Date();
    const jobs = dueJobs(now, getFiredIds_(now), getPhase());
    jobs.forEach(function (j) {
      // 二重発火防止のため先にマークする（失敗時は翌日ではなくログとサマリーで検知する方針）
      markFired_(now, j.id);
      try {
        globalThis[j.job]();
      } catch (e) {
        logError_(e, 'ジョブ ' + j.id);
        notifyAdmin_('【エラー】ジョブ ' + j.id + ' が失敗しました: ' + e.message);
      }
    });

    updateKpi_();
  } catch (e) {
    logError_(e, 'mainTick');
  }
}

/** LINE Webhook（WebApp としてデプロイ） */
function doPost(e) {
  try {
    handleLineWebhook_(e);
  } catch (err) {
    logError_(err, 'doPost');
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================= KPI =================

/**
 * KPI を Firebase へ反映する。Phase 1 は日次データのみ:
 * 「昨日の確定値」と「今日の基準値・予約」を表示する（リアルタイム売上は Phase 3 から）。
 */
function updateKpi_() {
  try {
    const todayStr = businessDate(new Date());
    const today = getDailyRow_(todayStr);
    const yesterday = getDailyRow_(shiftDate_(todayStr, -1));
    const ctx = todayCtx_(today, todayStr);
    const base = safeBaseline_(ctx);

    const kpi = {
      baseline: base ? base.sales : null,
      reservations: today ? today.reservations : null,
      reservation_guests: today ? today.reservation_guests : null,
      y_sales: yesterday ? yesterday.sales : null,
      y_guests: yesterday ? yesterday.guests : null,
      y_avg: (yesterday && yesterday.sales && yesterday.guests) ? Math.round(yesterday.sales / yesterday.guests) : null,
      y_gap_pct: null,
      gross_profit_est: estimateGrossProfit_(yesterday),
      task_rate: taskRateToday_(todayStr)
    };
    if (yesterday && yesterday.sales && base) {
      const yBase = safeBaseline_(todayCtx_(yesterday, shiftDate_(todayStr, -1)));
      if (yBase && yBase.sales > 0) kpi.y_gap_pct = Math.round((yesterday.sales - yBase.sales) / yBase.sales * 1000) / 10;
    }
    publishKpi_(kpi);
  } catch (e) {
    logError_(e, 'updateKpi');
  }
}

/** カテゴリ別原価率による粗利推定（§4-3）。データが無ければ null（表示側で「—」） */
function estimateGrossProfit_(row) {
  if (!row || !row.sales) return null;
  try {
    const values = getSheet_(CONFIG.SHEET.COST).getDataRange().getValues();
    // Phase 1 はカテゴリ別売上が取れないため、全体売上 × 加重平均原価率で近似
    let rateSum = 0, n = 0;
    for (let i = 1; i < values.length; i++) {
      const r = Number(values[i][1]);
      if (!isNaN(r) && r > 0) { rateSum += r; n++; }
    }
    if (!n) return null;
    const avgRate = rateSum / n;
    const fixedDaily = Number(prop_('FIXED_COST_DAILY', '0'));
    const labor = row.labor_hours ? row.labor_hours * Number(prop_('HOURLY_WAGE', '1200')) : 0;
    return Math.round(row.sales * (1 - avgRate) - labor - fixedDaily);
  } catch (e) {
    return null;
  }
}

function taskRateToday_(dateStr) {
  const fb = countFeedback_(dateStr);
  return fb.total > 0 ? Math.round(fb.completed / fb.total * 100) / 100 : null;
}

// ================= ジョブ実装 =================

/** 21:00 前夜: 翌日の朝礼ドラフトを生成。承認モードなら東さんへ承認依頼（§8-4） */
function jobDraftMorningBrief() {
  const tomorrow = shiftDate_(businessDate(new Date()), 1);
  const draft = generateBrief_(tomorrow);
  PropertiesService.getScriptProperties().setProperty('brief_draft_' + tomorrow, JSON.stringify(draft));
  if (isApprovalMode()) {
    requestBriefApproval_(tomorrow, draft.speech);
  }
  appendLog('info', 'system', '', '朝礼ドラフト生成: ' + tomorrow, isApprovalMode() ? '承認待ち' : '自動承認');
}

/** 14:30 朝礼の配信 */
function jobDeliverBrief() {
  const today = businessDate(new Date());
  ensureTodayRow_(); // 当日行の作成と自動列の付与

  let draft = loadBriefDraft_(today);
  if (isApprovalMode()) {
    if (!draft || draft.approved !== true) {
      // 未承認・却下は定型文へ（劣化して動き続ける）
      draft = { speech: FALLBACK_TEXTS.brief_none, display: '本日の朝礼（定型）', approved: false };
      appendLog('warn', 'brief', '', '朝礼が未承認のため定型文で配信', '');
    }
  } else if (!draft) {
    draft = generateBrief_(today); // 前夜分が無ければその場で生成
  }

  const audioUrl = ttsToUrl_(draft.speech);
  publishCurrent_({
    type: 'brief', to: 'all', label: '朝礼',
    text: draft.display || draft.speech, audio_url: audioUrl, rule_code: ''
  });
  recordIssue_('BRIEF', '', '朝礼', '');
}

/** 朝礼の生成（データ取得 → 欠測判定 → Claude → guard）。失敗はすべて定型文へ */
function generateBrief_(dateStr) {
  const yesterdayStr = shiftDate_(dateStr, -1);
  const yesterday = getDailyRow_(yesterdayStr);

  // 欠測フォールバックの水準を決める（§8-1）
  let fallbackLevel = 'full';
  if (!yesterday) fallbackLevel = 'none';
  else if (yesterday.sales === null || yesterday.guests === null) fallbackLevel = 'no_sales';

  let evalResult = null;
  let baseline = null;
  if (fallbackLevel === 'full') {
    baseline = safeBaseline_(todayCtx_(yesterday, yesterdayStr));
    evalResult = evaluateRules({
      sales: yesterday.sales, guests: yesterday.guests,
      baselineSales: baseline ? baseline.sales : 0,
      baselineGuests: baseline ? baseline.guests : 0
    }, RULES, { noBlameGapPct: CONFIG.THRESHOLD.NO_BLAME_GAP });
  }

  const data = {
    date: dateStr,
    fallback_level: fallbackLevel,
    yesterday: fallbackLevel === 'full' ? {
      sales: yesterday.sales, guests: yesterday.guests,
      rule_code: evalResult.code, facts: evalResult.facts, flags: evalResult.flags,
      intent: evalResult.rule.intent
    } : null,
    today: buildTodayInfo_(dateStr)
  };

  const fallbackText = fallbackLevel === 'full' ? FALLBACK_TEXTS.brief_no_sales : FALLBACK_TEXTS.brief_none;
  try {
    const p = buildBriefPrompt_(data);
    const parsed = safeJsonParse_(callClaude_(p.system, p.user));
    if (!parsed || !parsed.speech) throw new Error('朝礼JSONのパース失敗');
    const guarded = guardOrFallback_(parsed.speech, fallbackText, '朝礼');
    return { speech: guarded.text, display: guarded.guarded ? '本日の朝礼' : (parsed.display || ''), approved: null };
  } catch (e) {
    logError_(e, '朝礼生成');
    return { speech: fallbackText, display: '本日の朝礼（定型）', approved: null };
  }
}

/** 17:00 ピーク前アナウンス（固定文言・キャッシュMP3。Phase 2〜） */
function jobPeakPrep() {
  publishCurrent_({
    type: 'check', to: 'hall', label: 'ピーク前準備',
    text: FALLBACK_TEXTS.peak_prep, audio_url: ttsToUrl_(FALLBACK_TEXTS.peak_prep), rule_code: ''
  });
}

/** 22:30 ラストオーダー前アナウンス（Phase 2〜） */
function jobLastOrder() {
  publishCurrent_({
    type: 'check', to: 'hall', label: 'ラスト前',
    text: FALLBACK_TEXTS.last_order, audio_url: ttsToUrl_(FALLBACK_TEXTS.last_order), rule_code: ''
  });
}

/**
 * 20:00 中間チェック（Phase 2〜）。POSが無いため前日確定値ベースの判定。
 * アラート系（B-01/D-02）は店長スマホのみ・音声なし（§6-B の宛先ルール）。
 */
function jobMidCheck() {
  const yesterdayStr = shiftDate_(businessDate(new Date()), -1);
  const row = getDailyRow_(yesterdayStr);
  const baseline = row ? safeBaseline_(todayCtx_(row, yesterdayStr)) : null;
  const evalResult = evaluateRules({
    sales: row ? row.sales : null, guests: row ? row.guests : null,
    baselineSales: baseline ? baseline.sales : 0,
    baselineGuests: baseline ? baseline.guests : 0
  }, RULES, { noBlameGapPct: CONFIG.THRESHOLD.NO_BLAME_GAP });

  const data = { rule_code: evalResult.code, intent: evalResult.rule.intent, facts: evalResult.facts, flags: evalResult.flags };
  let display = FALLBACK_TEXTS.check;
  try {
    const p = buildCheckPrompt_(data);
    const parsed = safeJsonParse_(callClaude_(p.system, p.user));
    if (parsed && parsed.display) {
      display = guardOrFallback_(parsed.display, FALLBACK_TEXTS.check, '状況コメント').text;
    }
  } catch (e) { logError_(e, '状況コメント生成'); }

  recordIssue_(evalResult.code, '', '', evalResult.facts.sales_gap_pct);

  if (evalResult.rule.severity === 'alert') {
    // 数値乖離は店長のみ。音声もモニターも出さない
    linePushText_(prop_('LINE_MANAGER_USER_ID'), '【状況】' + display);
    // タスクを伴うルールは店長へ承認依頼（承認後にスタッフ配信）
    evalResult.rule.tasks.forEach(function (t) { proposeTask_(evalResult, t, display); });
  } else {
    // 平常・好調はモニターと音声へ（E-01 は称賛）
    publishCurrent_({
      type: evalResult.rule.severity === 'praise' ? 'praise' : 'check',
      to: 'hall', label: '中間チェック', text: display,
      audio_url: evalResult.rule.severity === 'praise' ? ttsToUrl_(display) : null,
      rule_code: evalResult.code
    });
  }
}

/** 00:30 日次振り返り（対象は前営業日） */
function jobDailyReview() {
  const dateStr = businessDate(new Date()); // 00:30 なので前日=営業日
  const row = getDailyRow_(dateStr);
  const baseline = row ? safeBaseline_(todayCtx_(row, dateStr)) : null;
  const evalResult = evaluateRules({
    sales: row ? row.sales : null, guests: row ? row.guests : null,
    baselineSales: baseline ? baseline.sales : 0,
    baselineGuests: baseline ? baseline.guests : 0
  }, RULES, { noBlameGapPct: CONFIG.THRESHOLD.NO_BLAME_GAP });

  let display = FALLBACK_TEXTS.review;
  try {
    const p = buildReviewPrompt_({ date: dateStr, rule_code: evalResult.code, facts: evalResult.facts, flags: evalResult.flags, note: row ? row.manager_note : null });
    const parsed = safeJsonParse_(callClaude_(p.system, p.user));
    if (parsed && parsed.display) {
      display = guardOrFallback_(parsed.display, FALLBACK_TEXTS.review, '日次振り返り').text;
    }
  } catch (e) { logError_(e, '振り返り生成'); }

  linePushText_(prop_('LINE_MANAGER_USER_ID'), '【本日の振り返り】\n' + display);
  appendLog('info', 'review', evalResult.code, display, 'line:manager');
  if (evalResult.facts.sales_gap_pct !== null) fillDailyDelta_(dateStr, evalResult.facts.sales_gap_pct);
}

/** 08:00 日次サマリー（ops/report.js） */
function jobDailySummary() {
  sendDailySummary_();
}

// ================= タスク承認フロー（§6-B） =================

/** ルール由来のタスクを店長へ承認依頼する。AIが直接スタッフに指示しない */
function proposeTask_(evalResult, taskDef, reasonText) {
  const taskId = 't' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const due = new Date(Date.now() + taskDef.due_min * 60000);
  const task = {
    title: taskDef.title,
    to: taskDef.to,
    due: Utilities.formatDate(due, CONFIG.TZ, 'HH:mm'),
    rule_code: evalResult.code,
    done: false, done_by: null, done_at: null
  };
  PropertiesService.getScriptProperties().setProperty('task_' + taskId, JSON.stringify(task));
  recordIssue_(evalResult.code, taskId, task.title, evalResult.facts.sales_gap_pct);
  requestTaskApproval_(taskId, task, reasonText);
}

function approveAndDeliverTask_(taskId) {
  const raw = prop_('task_' + taskId);
  if (!raw) return;
  const task = JSON.parse(raw);
  markTaskApproved_(taskId, true);
  deliverTaskToStaff_(taskId, task);
  // スタッフ向けタスクは音声＋モニターにも出す（§6-B 宛先表）
  const speech = 'タスクのお知らせです。' + task.title + '。' + task.due + 'までにお願いします。';
  publishCurrent_({
    type: 'task', to: task.to, label: 'タスク', text: task.title + '（' + task.due + 'まで）',
    audio_url: ttsToUrl_(speech), rule_code: task.rule_code
  });
}

function rejectTask_(taskId) {
  markTaskApproved_(taskId, false);
  appendLog('info', 'task', '', 'タスク見送り: ' + taskId, 'by:manager');
}

// ================= 朝礼ドラフトの承認状態 =================

function loadBriefDraft_(dateStr) {
  const raw = prop_('brief_draft_' + dateStr);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function markBriefApproved_(dateStr, approved) {
  const draft = loadBriefDraft_(dateStr);
  if (!draft) return;
  draft.approved = approved;
  PropertiesService.getScriptProperties().setProperty('brief_draft_' + dateStr, JSON.stringify(draft));
}

// ================= ヘルパー =================

function shiftDate_(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd');
}

/** 日報行から基準値算出用の文脈を作る */
function todayCtx_(row, dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    dow: DOW_KEYS[d.getDay()],
    weather: row && row.weather ? row.weather : 'cloudy',
    isEveHoliday: !!(row && row.is_eve_holiday)
  };
}

/** 基準値の取得（PLAN_DAILY_SALES 未設定などでも落とさない） */
function safeBaseline_(ctx) {
  try { return getTodayBaseline_(ctx); } catch (e) { return null; }
}

/** 朝礼プロンプト用の当日情報 */
function buildTodayInfo_(dateStr) {
  const row = getDailyRow_(dateStr);
  const base = safeBaseline_(todayCtx_(row, dateStr));
  return {
    date: dateStr,
    weather: row ? row.weather : null,
    is_holiday: row ? row.is_holiday : null,
    is_eve_holiday: row ? row.is_eve_holiday : null,
    reservations: row ? row.reservations : null,
    reservation_guests: row ? row.reservation_guests : null,
    baseline_sales: base ? base.sales : null
  };
}

// ================= セットアップ（初回に手動実行） =================

/** シート一式を作成する。既存シートは触らない */
function setupSheets() {
  const ss = getSpreadsheet_();
  const defs = [
    { name: CONFIG.SHEET.DAILY, header: DAILY_HEADER },
    { name: CONFIG.SHEET.BASELINE, header: ['key', 'coef', 'source', 'sample_n', 'updated_at'] },
    { name: CONFIG.SHEET.COST, header: ['category', 'cost_rate'] },
    { name: CONFIG.SHEET.FEEDBACK, header: FEEDBACK_HEADER },
    { name: CONFIG.SHEET.LOG, header: LOG_HEADER },
    { name: CONFIG.SHEET.STAFF, header: ['name'] },
    { name: CONFIG.SHEET.CONFIG, header: null }
  ];
  defs.forEach(function (d) {
    let sh = ss.getSheetByName(d.name);
    if (!sh) {
      sh = ss.insertSheet(d.name);
      if (d.header) {
        sh.getRange(1, 1, 1, d.header.length).setValues([d.header]).setFontWeight('bold');
        sh.setFrozenRows(1);
      }
    }
  });
  // キルスイッチのセル（config!A1 にラベル、B1 が本体）
  const conf = ss.getSheetByName(CONFIG.SHEET.CONFIG);
  if (!conf.getRange('A1').getValue()) {
    conf.getRange('A1').setValue('キルスイッチ（STOP と入力すると全発話が止まります）');
    conf.getRange('B1').setValue('RUN');
  }
  // baseline の初期係数（借り物）。既存店データ確定後に置き換える（OPEN_QUESTIONS #4）
  const bl = ss.getSheetByName(CONFIG.SHEET.BASELINE);
  if (bl.getLastRow() <= 1) {
    const at = nowIso_();
    [
      ['dow_mon', 0.80], ['dow_tue', 0.85], ['dow_wed', 0.90], ['dow_thu', 0.95],
      ['dow_fri', 1.30], ['dow_sat', 1.25], ['dow_sun', 0.95],
      ['weather_sunny', 1.00], ['weather_cloudy', 0.98], ['weather_rain', 0.90], ['weather_snow', 0.80],
      ['eve_holiday', 1.25]
    ].forEach(function (r) { bl.appendRow([r[0], r[1], 'borrowed', '', at]); });
  }
  // cost の初期値（§4-3 の例）
  const cost = ss.getSheetByName(CONFIG.SHEET.COST);
  if (cost.getLastRow() <= 1) {
    [['串類', 0.32], ['一品料理', 0.38], ['ドリンク', 0.18], ['デザート', 0.25]]
      .forEach(function (r) { cost.appendRow(r); });
  }
}

/** トリガー一式を作成する（重複作成しない） */
function setupTriggers() {
  const existing = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  if (existing.indexOf('mainTick') < 0) {
    ScriptApp.newTrigger('mainTick').timeBased().everyMinutes(5).create();
  }
  if (existing.indexOf('monitorHeartbeat') < 0) {
    ScriptApp.newTrigger('monitorHeartbeat').timeBased().everyMinutes(15).create();
  }
  if (existing.indexOf('checkRuleDemotion') < 0) {
    ScriptApp.newTrigger('checkRuleDemotion').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
  }
}
