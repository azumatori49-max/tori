/**
 * generate/claude.js — Claude API クライアント
 *
 * 用途は文面生成のみ（§6）。数値判定には絶対に使わない。
 * 失敗時は例外を投げ、呼び元が必ずフォールバック文面へ落ちること（§8-1）。
 */

/**
 * @param {string} system システムプロンプト
 * @param {string} user   ユーザープロンプト
 * @returns {string} 生成テキスト
 */
function callClaude_(system, user) {
  const apiKey = requiredProp_('ANTHROPIC_API_KEY');
  const model = prop_('CLAUDE_MODEL', CONFIG.CLAUDE_MODEL_DEFAULT);
  const payload = {
    model: model,
    max_tokens: CONFIG.CLAUDE_MAX_TOKENS,
    system: system,
    messages: [{ role: 'user', content: user }]
  };
  const res = withRetry_('claude', function () {
    return UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error('Claude API HTTP ' + code + ': ' + res.getContentText().slice(0, 300));
  const body = JSON.parse(res.getContentText());
  return body.content[0].text;
}

/** コードフェンス・前置きを剥がしてから JSON.parse。失敗時は null（呼び元でフォールバック） */
function safeJsonParse_(text) {
  try {
    let t = String(text).trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
    return JSON.parse(t);
  } catch (e) {
    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { safeJsonParse_ };
}
