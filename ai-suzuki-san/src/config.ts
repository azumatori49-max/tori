function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return v;
}

export const config = {
  port: Number(env("PORT", "3000")),

  anthropicApiKey: env("ANTHROPIC_API_KEY"),
  claudeModel: env("CLAUDE_MODEL", "claude-opus-4-8"),

  adminLineUserIds: env("ADMIN_LINE_USER_IDS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  lineChannelAccessToken: env("LINE_CHANNEL_ACCESS_TOKEN", ""),
  lineChannelSecret: env("LINE_CHANNEL_SECRET", ""),

  posterApiBase: env("POSTER_API_BASE", "https://poster.ooo/api"),
  posterClientId: env("POSTER_CLIENT_ID", ""),
  posterClientSecret: env("POSTER_CLIENT_SECRET", ""),
  posterWebhookKey: env("POSTER_WEBHOOK_KEY", ""),
  posterTagActive: env("POSTER_TAG_ACTIVE", ""),

  reminderAfterHours: Number(env("REMINDER_AFTER_HOURS", "48")),
  reminderMaxCount: Number(env("REMINDER_MAX_COUNT", "2")),

  dataDir: env("DATA_DIR", "./data"),
};

export function isAdmin(lineUserId: string): boolean {
  return config.adminLineUserIds.includes(lineUserId);
}
