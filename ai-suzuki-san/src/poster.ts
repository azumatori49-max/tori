import { config } from "./config.js";

/**
 * Poster API クライアント（タグ同期用・ベストエフォート）。
 *
 * ケースの状態管理はこのアプリの store が正であり、Posterのタグは
 * 「鈴木さんがPoster管理画面から状況を見られるようにする」ための同期。
 * 失敗しても業務フローは止めない（ログだけ残す）。
 *
 * ⚠️ エンドポイントのパス・リクエスト形式は Poster Developer Documents
 *    （https://poster.ooo/poster-dev-doc/mainpage/）で必ず確認して
 *    合わせること。以下は認証ヘッダ方式（APIクライアントのID/Secret）を
 *    前提とした雛形。POSTER_CLIENT_ID が未設定なら何もしない。
 */
export class PosterClient {
  private get enabled(): boolean {
    return Boolean(config.posterClientId && config.posterClientSecret);
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      "X-Poster-Client-Id": config.posterClientId,
      "X-Poster-Client-Secret": config.posterClientSecret,
    };
  }

  private async post(path: string, body: unknown): Promise<void> {
    if (!this.enabled) return;
    try {
      const res = await fetch(`${config.posterApiBase}${path}`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.warn(`[poster] ${path} failed (${res.status}): ${await res.text()}`);
      }
    } catch (e) {
      console.warn(`[poster] ${path} error:`, e);
    }
  }

  /** 友だちにタグを付与（要: 開発者ドキュメントでパス確認） */
  async addTag(lineUserId: string, tag: string): Promise<void> {
    if (!tag) return;
    await this.post("/tag/add", { line_uid: lineUserId, tag_name: tag });
  }

  /** 友だちからタグを削除（要: 開発者ドキュメントでパス確認） */
  async removeTag(lineUserId: string, tag: string): Promise<void> {
    if (!tag) return;
    await this.post("/tag/remove", { line_uid: lineUserId, tag_name: tag });
  }
}

export const poster = new PosterClient();
