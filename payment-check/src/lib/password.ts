import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "8文字以上で入力してください";
  if (!/[a-zA-Z]/.test(password)) return "英字を1文字以上含めてください";
  if (!/[0-9]/.test(password)) return "数字を1文字以上含めてください";
  return null;
}

export function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  // 英字・数字を必ず含める(14桁)
  return out + "a" + String(Math.floor(Math.random() * 10));
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
