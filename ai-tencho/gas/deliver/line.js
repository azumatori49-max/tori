/**
 * deliver/line.js — LINE Messaging API（配信と Webhook 受信）
 *
 * 宛先の使い分け（§6-B）:
 *  - LINE_ADMIN_USER_ID   … 東さん（承認・エラー通知・日次サマリー）
 *  - LINE_MANAGER_USER_ID … 店長（数値乖離・タスク承認依頼。人件費系はここだけ）
 *  - LINE_STAFF_GROUP_ID  … スタッフグループ（承認済みタスクの配信のみ）
 *
 * Webhook（doPost）で受けるもの:
 *  - postback: done:<taskId>        … タスク完了報告 → feedback へ記録
 *  - postback: approve_brief:<date> … 承認モードの朝礼承認
 *  - postback: approve_task:<id> / reject_task:<id> … 店長のタスク承認/却下
 */

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

function linePush_(to, messages) {
  if (!to) { appendLog('warn', 'system', '', 'LINE宛先未設定のため送信スキップ', ''); return; }
  const res = withRetry_('line', function () {
    return UrlFetchApp.fetch(LINE_PUSH_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + requiredProp_('LINE_CHANNEL_ACCESS_TOKEN') },
      payload: JSON.stringify({ to: to, messages: messages }),
      muteHttpExceptions: true
    });
  });
  if (res.getResponseCode() >= 300) throw new Error('LINE push HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
}

function linePushText_(to, text) {
  linePush_(to, [{ type: 'text', text: text }]);
}

/** 東さんへの通知（LINE 失敗時はメールにフォールバック。CHANGES_FROM_SPEC.md #4） */
function notifyAdmin_(text) {
  try {
    linePushText_(prop_('LINE_ADMIN_USER_ID'), text);
  } catch (e) {
    console.error('notifyAdmin LINE失敗: ' + e.message);
    try {
      const mail = prop_('ADMIN_EMAIL');
      if (mail) MailApp.sendEmail(mail, '[AI店長] 通知', text);
    } catch (e2) { console.error('notifyAdmin メールも失敗: ' + e2.message); }
  }
}

/** 店長へタスクの承認依頼を送る（AIが直接スタッフへ指示しないための関門。§6-B） */
function requestTaskApproval_(taskId, task, reasonText) {
  const to = prop_('LINE_MANAGER_USER_ID');
  linePush_(to, [{
    type: 'template',
    altText: 'タスク承認依頼: ' + task.title,
    template: {
      type: 'confirm',
      text: (reasonText + '\n\n提案タスク:「' + task.title + '」\nスタッフへ配信しますか?').slice(0, 240),
      actions: [
        { type: 'postback', label: '配信する', data: 'approve_task:' + taskId },
        { type: 'postback', label: '見送る', data: 'reject_task:' + taskId }
      ]
    }
  }]);
}

/** 承認済みタスクをスタッフグループへ配信する（完了ボタン付き） */
function deliverTaskToStaff_(taskId, task) {
  linePush_(prop_('LINE_STAFF_GROUP_ID'), [{
    type: 'template',
    altText: 'タスク: ' + task.title,
    template: {
      type: 'buttons',
      text: ('【タスク】' + task.title + '\n期限: ' + task.due).slice(0, 160),
      actions: [{ type: 'postback', label: '完了しました', data: 'done:' + taskId }]
    }
  }]);
  publishTask_(taskId, task);
  appendLog('info', 'task', task.rule_code || '', task.title, 'line:staff');
}

/** 承認モード：前夜の朝礼ドラフトを東さんへ送る（§8-4） */
function requestBriefApproval_(dateStr, speech) {
  linePush_(prop_('LINE_ADMIN_USER_ID'), [{
    type: 'template',
    altText: '明日の朝礼の承認依頼',
    template: {
      type: 'confirm',
      text: ('【' + dateStr + ' 朝礼案】\n' + speech).slice(0, 240),
      actions: [
        { type: 'postback', label: '承認', data: 'approve_brief:' + dateStr },
        { type: 'postback', label: '却下', data: 'reject_brief:' + dateStr }
      ]
    }
  }]);
  linePushText_(prop_('LINE_ADMIN_USER_ID'), '朝礼案の全文:\n' + speech);
}

/** LINE Webhook の処理本体（main.js の doPost から呼ばれる） */
function handleLineWebhook_(e) {
  const body = JSON.parse(e.postData.contents);
  (body.events || []).forEach(function (ev) {
    if (ev.type !== 'postback') return;
    const data = String(ev.postback.data || '');
    const sep = data.indexOf(':');
    const action = data.slice(0, sep);
    const id = data.slice(sep + 1);
    const userId = ev.source && ev.source.userId;

    if (action === 'done') {
      recordTaskCompleted_(id, userId);
    } else if (action === 'approve_task') {
      approveAndDeliverTask_(id);
    } else if (action === 'reject_task') {
      rejectTask_(id);
    } else if (action === 'approve_brief') {
      markBriefApproved_(id, true);
      notifyAdmin_('朝礼を承認しました。明朝配信されます。');
    } else if (action === 'reject_brief') {
      markBriefApproved_(id, false);
      notifyAdmin_('朝礼を却下しました。明朝は定型文で配信されます。');
    }
  });
}
