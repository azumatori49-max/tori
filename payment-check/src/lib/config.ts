export const DEFAULT_ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ?? "admin@toriyaro.com";
export const DEFAULT_ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ?? "toriyaro@1234";

export const APP_NAME = "CHIBIC 入金確認";

export function nowString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}
