import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { config, isAdmin } from "./config.js";
import { store, type ChatTurn } from "./store.js";
import { line } from "./line.js";
import { poster } from "./poster.js";

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const MAX_TOKENS = 4096;

// ---------------------------------------------------------------------------
// システムプロンプト
// ---------------------------------------------------------------------------

const ADMIN_SYSTEM = `あなたは「AI鈴木さん」。経理事務の鈴木さんの補佐をするアシスタントです。
鈴木さんは入社手続き・給与手続きの書類チェックをしていて、不備を見つけたときにあなたにLINEで報告してきます。あなたの仕事は、その不備を本人（従業員）に分かりやすく伝えて、解決まで面倒を見ることです。

## 不備の登録の受け方
鈴木さんからのメッセージから次の4つを読み取ってください：
1. 従業員のLINE UID（Poster管理画面の「友だち検索」で確認できる、Uで始まるID）
2. 従業員の名前
3. 対象の書類・手続き（例: 雇用契約書、給与振込口座届、扶養控除申告書）
4. 不備の内容（何が抜けている・間違っているか）
期限があれば期限も。

足りない情報があれば短く聞き返してください。特にLINE UIDがないと本人に連絡できないので、無い場合は「Posterの友だち検索でその方のLINE UIDをコピーして送ってください」と案内します。

4つ揃ったら register_case ツールで登録します。message_to_employee には、従業員向けの丁寧で分かりやすい通知文を書いてください：
- 会社の公式LINEからの連絡であること、書類の不備の連絡であることが最初に分かるように
- どの書類の・どこを・どう直せばいいかを具体的に
- 質問があればこのLINEでそのまま返信すればよいことを添える
- 威圧的にならない、丁寧だが簡潔な日本語

## その他できること
- list_cases: 対応中の案件一覧を鈴木さんに見せる
- resolve_case: 鈴木さんが「OK」「解決した」と言った案件を完了にする
- message_employee: 鈴木さんの指示で従業員に追加のメッセージを送る

## 注意
- マイナンバーや口座番号そのものをメッセージに含めない。「◯◯欄をご記入ください」のように項目名で案内する。
- ツールを使ったあとは、何をしたかを鈴木さんに一言で報告する。
- 返答は短く。LINEでのやり取りなので長文は避ける。`;

const EMPLOYEE_SYSTEM = `あなたは「AI鈴木さん」。会社の経理担当・鈴木さんに代わって、入社手続き・給与手続きの書類の不備について従業員をサポートするアシスタントです。会社の公式LINEアカウントを通じて会話しています。

## あなたの役割
- 従業員が抱えている書類の不備（ケース情報として渡されます）について、質問に答え、修正・再提出まで案内する
- 「どの欄ですか」「どう書けばいいですか」といった質問に、具体的に丁寧に答える
- 制度の判断（税・社会保険の個別判断など）や、ケース情報から答えられないことは無理に答えず、notify_admin で鈴木さんに引き継ぐ
- 従業員が「提出しました」「直しました」と言ったら mark_done ツールで完了報告する（鈴木さんが確認します）
- 画像やファイルが送られてきた旨のメッセージを受け取ったら、受領した旨を伝えて notify_admin で鈴木さんに確認を依頼する

## 注意
- マイナンバー・口座番号などをLINEで送らないよう案内する（書類に記入して提出してもらう）
- 丁寧だが硬すぎない日本語で、短く分かりやすく
- 分からないことを推測で答えない。迷ったら notify_admin`;

// ---------------------------------------------------------------------------
// 履歴 → メッセージ配列
// ---------------------------------------------------------------------------

function toMessages(history: ChatTurn[], newUserText: string): Anthropic.Beta.BetaMessageParam[] {
  const msgs: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({
    role: t.role,
    content: t.text,
  }));
  msgs.push({ role: "user", content: newUserText });
  return msgs;
}

function extractText(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// ---------------------------------------------------------------------------
// 管理者（鈴木さん）との会話
// ---------------------------------------------------------------------------

export async function handleAdminMessage(userId: string, text: string): Promise<string> {
  const registerCase = betaZodTool({
    name: "register_case",
    description:
      "書類不備の案件を登録し、従業員本人のLINEに通知を送る。必要情報が揃ってから呼ぶこと。",
    inputSchema: z.object({
      employee_user_id: z.string().describe("従業員のLINE UID（Uで始まる）"),
      employee_name: z.string().describe("従業員の氏名"),
      document: z.string().describe("対象の書類・手続き名"),
      issue: z.string().describe("不備の内容"),
      deadline: z.string().optional().describe("期限（あれば）"),
      message_to_employee: z
        .string()
        .describe("従業員本人にLINEで送る通知文（丁寧で具体的な日本語）"),
    }),
    run: async (input) => {
      const existing = store.activeCaseForEmployee(input.employee_user_id);
      if (existing) {
        return `この従業員には対応中の案件（#${existing.id}: ${existing.document}）が既にあります。先に resolve_case で完了させるか、message_employee で追記してください。`;
      }
      const c = store.createCase({
        employeeUserId: input.employee_user_id,
        employeeName: input.employee_name,
        document: input.document,
        issue: input.issue,
        deadline: input.deadline,
      });
      await line.pushText(input.employee_user_id, input.message_to_employee);
      await poster.addTag(input.employee_user_id, config.posterTagActive);
      return `案件 #${c.id} を登録し、${input.employee_name}さんに通知を送信しました。`;
    },
  });

  const listCases = betaZodTool({
    name: "list_cases",
    description: "対応中（未解決）の不備案件の一覧を取得する。",
    inputSchema: z.object({}),
    run: async () => {
      const cases = store.listActiveCases();
      if (cases.length === 0) return "対応中の案件はありません。";
      return cases
        .map(
          (c) =>
            `#${c.id} ${c.employeeName} / ${c.document} / ${c.issue} / 状態: ${
              c.status === "waiting_review" ? "本人対応済み・確認待ち" : "対応中"
            } / 催促${c.reminderCount}回`,
        )
        .join("\n");
    },
  });

  const resolveCase = betaZodTool({
    name: "resolve_case",
    description: "案件を完了（解決済み）にする。従業員本人にも完了の連絡が送られる。",
    inputSchema: z.object({
      case_id: z.string().describe("案件ID（#なし）"),
    }),
    run: async ({ case_id }) => {
      const c = store.getCase(case_id.replace(/^#/, ""));
      if (!c) return `案件 ${case_id} が見つかりません。list_cases で確認してください。`;
      store.updateCase(c.id, { status: "resolved" });
      await poster.removeTag(c.employeeUserId, config.posterTagActive);
      await line
        .pushText(
          c.employeeUserId,
          `${c.document}の件、確認が取れました。ご対応ありがとうございました！`,
        )
        .catch(() => {});
      return `案件 #${c.id}（${c.employeeName}さん / ${c.document}）を完了にしました。`;
    },
  });

  const messageEmployee = betaZodTool({
    name: "message_employee",
    description: "対応中の案件の従業員に、鈴木さんの指示で追加メッセージを送る。",
    inputSchema: z.object({
      case_id: z.string().describe("案件ID（#なし）"),
      message: z.string().describe("従業員に送るメッセージ本文"),
    }),
    run: async ({ case_id, message }) => {
      const c = store.getCase(case_id.replace(/^#/, ""));
      if (!c) return `案件 ${case_id} が見つかりません。`;
      await line.pushText(c.employeeUserId, message);
      return `${c.employeeName}さんに送信しました。`;
    },
  });

  const finalMessage = await client.beta.messages.toolRunner({
    model: config.claudeModel,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: ADMIN_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [registerCase, listCases, resolveCase, messageEmployee],
    messages: toMessages(store.getHistory(userId), text),
  });

  const reply = extractText(finalMessage) || "（処理しました）";
  const now = new Date().toISOString();
  store.appendTurn(userId, { role: "user", text, at: now });
  store.appendTurn(userId, { role: "assistant", text: reply, at: now });
  return reply;
}

// ---------------------------------------------------------------------------
// 従業員との会話
// ---------------------------------------------------------------------------

export async function handleEmployeeMessage(
  userId: string,
  text: string,
): Promise<string | null> {
  const activeCase = store.activeCaseForEmployee(userId);
  // 対応中の案件がない従業員には反応しない（Poster側の通常の自動応答に任せる）
  if (!activeCase) return null;

  store.touchEmployeeActivity(userId);

  const notifyAdmin = betaZodTool({
    name: "notify_admin",
    description:
      "鈴木さん（経理担当）に連絡する。自分では答えられない質問、画像・ファイルの確認依頼、その他人の判断が必要なときに使う。",
    inputSchema: z.object({
      summary: z.string().describe("鈴木さんに伝える内容の要約"),
    }),
    run: async ({ summary }) => {
      for (const adminId of config.adminLineUserIds) {
        await line
          .pushText(
            adminId,
            `【AI鈴木さん】案件 #${activeCase.id}（${activeCase.employeeName}さん / ${activeCase.document}）\n${summary}`,
          )
          .catch(() => {});
      }
      return "鈴木さんに連絡しました。";
    },
  });

  const markDone = betaZodTool({
    name: "mark_done",
    description:
      "従業員が修正・再提出を完了したと言ったときに使う。案件を「確認待ち」にして鈴木さんに確認を依頼する。",
    inputSchema: z.object({
      note: z.string().optional().describe("補足（何をどう対応したか）"),
    }),
    run: async ({ note }) => {
      store.updateCase(activeCase.id, { status: "waiting_review" });
      for (const adminId of config.adminLineUserIds) {
        await line
          .pushText(
            adminId,
            `【AI鈴木さん】案件 #${activeCase.id}（${activeCase.employeeName}さん / ${activeCase.document}）本人が対応完了とのことです。ご確認ください。${
              note ? `\n補足: ${note}` : ""
            }\n確認OKなら「#${activeCase.id} OK」と返信してください。`,
          )
          .catch(() => {});
      }
      return "鈴木さんに確認を依頼しました。";
    },
  });

  const caseContext = `## 現在の案件情報
- 案件ID: #${activeCase.id}
- 従業員: ${activeCase.employeeName}さん
- 対象書類: ${activeCase.document}
- 不備の内容: ${activeCase.issue}
${activeCase.deadline ? `- 期限: ${activeCase.deadline}` : ""}
- 状態: ${activeCase.status === "waiting_review" ? "本人対応済み・鈴木さん確認待ち" : "対応中"}`;

  const finalMessage = await client.beta.messages.toolRunner({
    model: config.claudeModel,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: EMPLOYEE_SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: caseContext },
    ],
    tools: [notifyAdmin, markDone],
    messages: toMessages(store.getHistory(userId), text),
  });

  const reply = extractText(finalMessage) || "確認しますので少々お待ちください。";
  const now = new Date().toISOString();
  store.appendTurn(userId, { role: "user", text, at: now });
  store.appendTurn(userId, { role: "assistant", text: reply, at: now });
  return reply;
}

// ---------------------------------------------------------------------------
// 入口: 管理者か従業員かで振り分け
// ---------------------------------------------------------------------------

export async function handleIncomingText(
  userId: string,
  text: string,
): Promise<string | null> {
  if (isAdmin(userId)) {
    return handleAdminMessage(userId, text);
  }
  return handleEmployeeMessage(userId, text);
}
