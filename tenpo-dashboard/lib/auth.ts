import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "td_session";
const SESSION_DAYS = 30;

export type Session =
	| { role: "store"; storeCode: string }
	| { role: "admin" };

function secret(): string {
	const s = process.env.AUTH_SECRET;
	if (s) return s;
	// 本番で未設定のまま動くとセッション Cookie が偽造可能になるため起動を拒否する
	if (process.env.NODE_ENV === "production") {
		throw new Error("AUTH_SECRET が設定されていません(セッション保護のため必須です)");
	}
	return "dev-secret-change-me";
}

function sign(data: string): string {
	return createHmac("sha256", secret()).update(data).digest("base64url");
}

export async function createSession(session: Session): Promise<void> {
	const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
	const payload = Buffer.from(JSON.stringify({ ...session, exp })).toString("base64url");
	const token = `${payload}.${sign(payload)}`;
	const jar = await cookies();
	jar.set(COOKIE_NAME, token, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: SESSION_DAYS * 24 * 60 * 60,
		path: "/",
	});
}

export async function getSession(): Promise<Session | null> {
	const jar = await cookies();
	const token = jar.get(COOKIE_NAME)?.value;
	if (!token) return null;
	const dot = token.lastIndexOf(".");
	if (dot < 0) return null;
	const payload = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const expected = sign(payload);
	if (sig.length !== expected.length) return null;
	if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
	try {
		const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
		if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
		if (parsed.role === "store" && typeof parsed.storeCode === "string") {
			return { role: "store", storeCode: parsed.storeCode };
		}
		if (parsed.role === "admin") return { role: "admin" };
		return null;
	} catch {
		return null;
	}
}

export async function destroySession(): Promise<void> {
	const jar = await cookies();
	jar.delete(COOKIE_NAME);
}

/** `salt:hash` 形式で保存するパスワードハッシュを作る */
export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString("hex");
	const hash = scryptSync(password, salt, 32).toString("hex");
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(":");
	if (!salt || !hash) return false;
	const candidate = scryptSync(password, salt, 32);
	const expected = Buffer.from(hash, "hex");
	if (candidate.length !== expected.length) return false;
	return timingSafeEqual(candidate, expected);
}
