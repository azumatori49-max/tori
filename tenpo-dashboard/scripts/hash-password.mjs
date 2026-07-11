// 店舗ログイン用パスワードのハッシュを生成するユーティリティ。
// 使い方: node scripts/hash-password.mjs <パスワード>
// 出力された `salt:hash` を stores.password_hash に保存してください。
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
	console.error("使い方: node scripts/hash-password.mjs <パスワード>");
	process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 32).toString("hex");
console.log(`${salt}:${hash}`);
