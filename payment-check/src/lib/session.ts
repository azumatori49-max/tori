import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7日間

function secret(): string {
  return process.env.SESSION_SECRET ?? "payment-check-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export type Session = { email: string; name: string; exp: number };

export function createSessionCookie(email: string, name: string): void {
  const session: Session = { email, name, exp: Date.now() + SESSION_TTL_MS };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  cookies().set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

export function destroySession(): void {
  cookies().delete(COOKIE_NAME);
}

export function getSession(): Session | null {
  const cookie = cookies().get(COOKIE_NAME)?.value;
  if (!cookie) return null;

  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    ) as Session;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
