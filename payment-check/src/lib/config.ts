export const DEFAULT_ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ?? "admin@toriyaro.com";
export const DEFAULT_ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ?? "toriyaro@1234";

export function nowString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
