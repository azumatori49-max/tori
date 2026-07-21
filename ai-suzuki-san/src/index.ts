import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { verifyHmacSignature } from "./verify.js";
import { handleIncomingText } from "./ai.js";
import { store } from "./store.js";
import { line } from "./line.js";
import { poster } from "./poster.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

/**
 * PosterのLINE-Webhook全転送を受けるエンドポイント。
 * PosterがLINEから受け取ったWebhookイベントをそのまま転送してくる。
 * ボディはLINE Messaging APIのWebhook形式（{ destination, events: [...] }）。
 */
app.post("/webhook/line", async (c) => {
  const rawBody = await c.req.text();

  // 署名検証: Poster転送分は X-Poster-Signature、LINE直接なら x-line-signature。
  // どちらかの検証に通ればOK。両方の鍵が未設定の場合のみスキップ（開発時）。
  const posterSig = c.req.header("x-poster-signature");
  const lineSig = c.req.header("x-line-signature");
  const hasKeys = Boolean(config.posterWebhookKey || config.lineChannelSecret);
  if (hasKeys) {
    const ok =
      verifyHmacSignature(rawBody, posterSig, config.posterWebhookKey) ||
      verifyHmacSignature(rawBody, lineSig, config.lineChannelSecret);
    if (!ok) {
      console.warn("[webhook] signature verification failed");
      return c.text("unauthorized", 401);
    }
  }

  let body: { events?: LineWebhookEvent[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.text("bad request", 400);
  }

  // LINEのWebhookは即時200を返すのが作法。処理は非同期で。
  const events = body.events ?? [];
  queueMicrotask(() => {
    void processEvents(events);
  });
  return c.text("ok", 200);
});

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { id: string; type: string; text?: string };
}

async function processEvents(events: LineWebhookEvent[]): Promise<void> {
  for (const ev of events) {
    try {
      await processEvent(ev);
    } catch (e) {
      console.error("[webhook] event processing error:", e);
    }
  }
}

async function processEvent(ev: LineWebhookEvent): Promise<void> {
  if (ev.type !== "message" || ev.source?.type !== "user") return;
  const userId = ev.source.userId;
  if (!userId) return;

  const msg = ev.message;
  let text: string | undefined;

  if (msg?.type === "text" && msg.text) {
    text = msg.text;
  } else if (msg && ["image", "file", "video"].includes(msg.type)) {
    // 添付は中身を扱わず、受領の事実だけAIに渡す（内容確認は鈴木さんに引き継がれる）
    text = `（${msg.type === "image" ? "画像" : "ファイル"}が送信されました。メッセージID: ${msg.id}）`;
  } else {
    return; // スタンプ等は無視
  }

  const reply = await handleIncomingText(userId, text);
  // reply が null = 対応中案件のない従業員 → 何もしない（既存の自動応答に任せる）
  if (reply) {
    await line.respond(userId, ev.replyToken, reply);
  }
}

/**
 * リマインドループ: 1時間ごとに、放置されている案件をチェック。
 * - 従業員の最終アクティビティから REMINDER_AFTER_HOURS 経過 → 催促を送信
 * - 催促が REMINDER_MAX_COUNT 回を超えたら鈴木さんにエスカレーション
 */
async function reminderTick(): Promise<void> {
  const now = Date.now();
  const thresholdMs = config.reminderAfterHours * 60 * 60 * 1000;

  for (const c of store.listActiveCases()) {
    if (c.status !== "open") continue;
    const idleMs = now - new Date(c.lastEmployeeActivityAt).getTime();
    if (idleMs < thresholdMs * (c.reminderCount + 1)) continue;

    if (c.reminderCount < config.reminderMaxCount) {
      await line
        .pushText(
          c.employeeUserId,
          `【リマインド】${c.document}の件、まだご対応いただけていないようです。${c.issue}のご対応をお願いします。ご不明点があればこのままご返信ください。${
            c.deadline ? `（期限: ${c.deadline}）` : ""
          }`,
        )
        .catch((e) => console.warn("[reminder] push failed:", e));
      store.updateCase(c.id, { reminderCount: c.reminderCount + 1 });
      console.log(`[reminder] sent reminder ${c.reminderCount + 1} for case #${c.id}`);
    } else {
      for (const adminId of config.adminLineUserIds) {
        await line
          .pushText(
            adminId,
            `【AI鈴木さん】案件 #${c.id}（${c.employeeName}さん / ${c.document}）に${config.reminderMaxCount}回催促しましたが反応がありません。エリアマネージャー経由での声かけなど、別の手段をご検討ください。`,
          )
          .catch(() => {});
      }
      // エスカレーション済みとして以後の催促を止める（カウントを進める）
      store.updateCase(c.id, { reminderCount: c.reminderCount + 1 });
      console.log(`[reminder] escalated case #${c.id} to admins`);
    }
  }
}

setInterval(() => void reminderTick(), 60 * 60 * 1000);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`AI鈴木さん listening on :${info.port}`);
  console.log(`- Webhook URL: POST /webhook/line （PosterのLINE-Webhook全転送先に設定）`);
  console.log(`- 管理者UID: ${config.adminLineUserIds.join(", ") || "（未設定）"}`);
  if (!config.lineChannelAccessToken) {
    console.warn("⚠ LINE_CHANNEL_ACCESS_TOKEN が未設定です。メッセージ送信ができません。");
  }
  void poster; // タグ同期はケース登録/完了時に実行される
});
