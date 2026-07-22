import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getUserById, type User } from './db';

const COOKIE_NAME = 'scheduler_session';

function secret(): string {
	const s = process.env.SESSION_SECRET;
	if (!s) throw new Error('SESSION_SECRET is not set');
	return s;
}

function sign(value: string): string {
	return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export async function setSession(userId: number): Promise<void> {
	const value = String(userId);
	const cookieStore = await cookies();
	cookieStore.set(COOKIE_NAME, `${value}.${sign(value)}`, {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.APP_URL?.startsWith('https') ?? false,
		path: '/',
		maxAge: 60 * 60 * 24 * 30,
	});
}

export async function clearSession(): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<User | null> {
	const cookieStore = await cookies();
	const raw = cookieStore.get(COOKIE_NAME)?.value;
	if (!raw) return null;
	const dot = raw.lastIndexOf('.');
	if (dot < 0) return null;
	const value = raw.slice(0, dot);
	const sig = raw.slice(dot + 1);
	const expected = sign(value);
	if (
		sig.length !== expected.length ||
		!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
	) {
		return null;
	}
	const user = getUserById(Number(value));
	return user ?? null;
}
