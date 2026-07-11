// Firestore に店舗の初期データを投入するスクリプト。
// STORES の内容を実店舗に合わせて編集してから実行してください。
// 既に同じ店舗コードが存在する場合はスキップします(再実行しても安全)。
//
// 使い方(いずれかの認証方法で):
//   FIREBASE_SERVICE_ACCOUNT='{"project_id":...}' node scripts/seed-firestore.mjs
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/seed-firestore.mjs
import { randomBytes, scryptSync } from "node:crypto";
import { cert, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const STORES = [
	{ code: "101", name: "福島栄町店", brand: "鶏ヤロー・まる助", password: "kaeru-101" },
	{ code: "102", name: "郡山駅前店", brand: "鶏ヤロー", password: "kaeru-102" },
	{ code: "103", name: "いわき平店", brand: "鶏ヤロー", password: "kaeru-103" },
];

function hashPassword(password) {
	const salt = randomBytes(16).toString("hex");
	return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

const app = process.env.FIREBASE_SERVICE_ACCOUNT
	? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
	: initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

for (const store of STORES) {
	const existing = await db.collection("stores").where("code", "==", store.code).limit(1).get();
	if (!existing.empty) {
		console.log(`skip: ${store.code} ${store.name}(登録済み)`);
		continue;
	}
	await db.collection("stores").add({
		code: store.code,
		name: store.name,
		brand: store.brand,
		passwordHash: hashPassword(store.password),
		active: true,
	});
	console.log(`created: ${store.code} ${store.name}`);
}

console.log("完了");
