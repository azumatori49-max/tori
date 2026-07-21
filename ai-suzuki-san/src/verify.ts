import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-SHA256 + Base64 の署名検証。
 * - LINE Webhook: `x-line-signature` ヘッダ、鍵はチャネルシークレット
 * - Poster イベントフック: `X-Poster-Signature` ヘッダ、鍵は webhook_key
 * どちらも同じアルゴリズム（HMAC-SHA256 → Base64）。
 */
export function verifyHmacSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
