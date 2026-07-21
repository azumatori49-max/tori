import { config } from "./config.js";

/**
 * LINE Messaging API クライアント（送信用）。
 * PosterはこのLINE公式アカウントのMessaging APIチャネルの上に乗っているため、
 * 同じチャネルアクセストークンでプッシュ送信すると、従業員には
 * いつもの公式アカウント（WINWIN社内報）からのメッセージとして届く。
 */
export class LineClient {
  private base = "https://api.line.me/v2/bot";

  private get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.lineChannelAccessToken}`,
    };
  }

  async pushText(toUserId: string, text: string): Promise<void> {
    const res = await fetch(`${this.base}/message/push`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        to: toUserId,
        messages: [{ type: "text", text }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LINE push failed (${res.status}): ${body}`);
    }
  }

  async replyText(replyToken: string, text: string): Promise<boolean> {
    const res = await fetch(`${this.base}/message/reply`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
      }),
    });
    // replyTokenは短命 + 1回限り。失敗したら呼び出し側でpushにフォールバックする。
    return res.ok;
  }

  /** 返信を試み、ダメならプッシュ送信にフォールバック */
  async respond(userId: string, replyToken: string | undefined, text: string): Promise<void> {
    if (replyToken) {
      const ok = await this.replyText(replyToken, text).catch(() => false);
      if (ok) return;
    }
    await this.pushText(userId, text);
  }
}

export const line = new LineClient();
