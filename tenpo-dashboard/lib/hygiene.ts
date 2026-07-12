// 既存の衛生管理アプリ(toriyaro-eisei / Firebase Realtime Database)から
// 提出状況をリアルタイムに読み取るモジュール。
//
// 既存アプリのデータ構造:
//   stores/{storeKey} = { name, password }
//   submissions/{storeKey}/daily/{YYYY-MM-DD}   = { count, total?, submittedAt, photos, storeName }
//   submissions/{storeKey}/weekly/{Wyyyy-mm-dd} = 同上(キーは週の月曜日)
//
// 読み取り方法は 2 通り:
// 1) HYGIENE_FIREBASE_SERVICE_ACCOUNT が設定されていれば、そのサービスアカウントで
//    認証して読む(現行の v2 データベースは非公開のためこちらが必要)
// 2) 未設定なら候補 URL を順に試して公開 REST で読む(旧アプリ互換)
// ダッシュボードの店舗とは「店舗名」で自動マッチングする。
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import type { HygieneStatus, Store } from "./types";

// 現行の衛生管理アプリは toriyaro-eisei-v2 プロジェクト。
// 旧プロジェクト(faf2e)も後方互換のため候補に残す。
const PROJECTS = ["toriyaro-eisei-v2", "toriyaro-eisei-faf2e"];
const CANDIDATE_URLS = PROJECTS.flatMap((p) => [
	`https://${p}-default-rtdb.firebaseio.com`,
	`https://${p}-default-rtdb.asia-southeast1.firebasedatabase.app`,
	`https://${p}-default-rtdb.europe-west1.firebasedatabase.app`,
	`https://${p}.firebaseio.com`,
]);

const DAILY_REQUIRED = 7;
const WEEKLY_REQUIRED = 7;

// v2 データベースの実体(診断で確認済み: asia-southeast1)
const V2_DB_URL = "https://toriyaro-eisei-v2-default-rtdb.asia-southeast1.firebasedatabase.app";

/* ===== サービスアカウント認証(HYGIENE_FIREBASE_SERVICE_ACCOUNT) ===== */

function hygieneAdminDb(): Database | null {
	const sa = process.env.HYGIENE_FIREBASE_SERVICE_ACCOUNT;
	if (!sa) return null;
	const envUrl = process.env.HYGIENE_RTDB_URL;
	const url = envUrl && envUrl !== "off" ? envUrl.replace(/\/+$/, "") : V2_DB_URL;
	const existing = getApps().find((a) => a.name === "hygiene");
	const app =
		existing ??
		initializeApp({ credential: cert(JSON.parse(sa)), databaseURL: url }, "hygiene");
	return getDatabase(app);
}

/* ===== 接続先 URL の自動検出(公開 REST モード) ===== */

type ProbeResult = { url: string; status: number | string; hasStores: boolean };

async function probe(url: string): Promise<ProbeResult> {
	try {
		const res = await fetch(`${url}/stores.json?shallow=true`, {
			signal: AbortSignal.timeout(5000),
			cache: "no-store",
		});
		if (!res.ok) return { url, status: res.status, hasStores: false };
		const body = (await res.json()) as unknown;
		return { url, status: 200, hasStores: body !== null };
	} catch (e) {
		return { url, status: e instanceof Error ? e.message : "接続エラー", hasStores: false };
	}
}

async function probeAll(): Promise<ProbeResult[]> {
	return Promise.all(CANDIDATE_URLS.map(probe));
}

function pickUrl(probes: ProbeResult[]): string | null {
	// stores データが実在する URL を最優先、なければ 200 が返る URL
	return (
		probes.find((p) => p.status === 200 && p.hasStores)?.url ??
		probes.find((p) => p.status === 200)?.url ??
		null
	);
}

let detected: { url: string | null; at: number } | null = null;

async function resolveBaseUrl(): Promise<string | null> {
	const envUrl = process.env.HYGIENE_RTDB_URL;
	if (envUrl === "off") return null;
	if (envUrl) return envUrl.replace(/\/+$/, "");
	const ttl = detected?.url ? 10 * 60_000 : 2 * 60_000; // 未検出時は短めに再試行
	if (detected && Date.now() - detected.at < ttl) return detected.url;
	detected = { url: pickUrl(await probeAll()), at: Date.now() };
	return detected.url;
}

/* ===== 既存アプリと同じ期間キー(JST) ===== */
// 深夜営業のため、朝の締め時刻(既定 6 時)までは前日の営業日として扱う。
// ただし提出がどちらの日付キーで記録されていても拾えるよう、
// 営業日ベースとカレンダー日ベースの両方の候補キーを返し、
// 取得時は提出時刻が新しい方を採用する。

const DAY_CUTOFF_HOUR = (() => {
	const n = Number(process.env.HYGIENE_DAY_CUTOFF_HOUR ?? "6");
	return Number.isFinite(n) && n >= 0 && n <= 12 ? n : 6;
})();

const pad = (n: number) => String(n).padStart(2, "0");

function jstDate(cutoffHours = 0): Date {
	return new Date(Date.now() + (9 - cutoffHours) * 3600_000);
}

function dateKeyOf(d: Date): string {
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function weekKeyOf(d: Date): string {
	const m = new Date(d);
	const dow = m.getUTCDay();
	m.setUTCDate(m.getUTCDate() + (dow === 0 ? -6 : 1 - dow)); // その週の月曜日
	return `W${m.getUTCFullYear()}-${pad(m.getUTCMonth() + 1)}-${pad(m.getUTCDate())}`;
}

/** 営業日ベースの今日(表示用) */
export function dailyKeyJST(): string {
	return dateKeyOf(jstDate(DAY_CUTOFF_HOUR));
}

export function weeklyKeyJST(): string {
	return weekKeyOf(jstDate(DAY_CUTOFF_HOUR));
}

/** 検索対象の候補キー(営業日とカレンダー日。深夜帯のみ 2 件になる) */
export function dailyKeyCandidates(): string[] {
	const keys = [dateKeyOf(jstDate(DAY_CUTOFF_HOUR)), dateKeyOf(jstDate(0))];
	return keys[0] === keys[1] ? [keys[0]] : keys;
}

export function weeklyKeyCandidates(): string[] {
	const keys = [weekKeyOf(jstDate(DAY_CUTOFF_HOUR)), weekKeyOf(jstDate(0))];
	return keys[0] === keys[1] ? [keys[0]] : keys;
}

/* ===== RTDB REST 読み取り(短時間キャッシュ付き) ===== */

const cache = new Map<string, { at: number; data: unknown }>();

async function rtdbGet(base: string, path: string, ttlMs: number): Promise<unknown> {
	const url = `${base}/${path}.json`;
	const hit = cache.get(url);
	if (hit && Date.now() - hit.at < ttlMs) return hit.data;
	const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
	if (!res.ok) throw new Error(`hygiene RTDB ${res.status} for ${path}`);
	const data = (await res.json()) as unknown;
	cache.set(url, { at: Date.now(), data });
	return data;
}

/** サービスアカウント認証があれば Admin SDK、なければ公開 REST で読む */
async function readPath(path: string, ttlMs: number): Promise<unknown> {
	const db = hygieneAdminDb();
	if (db) {
		const key = `admin:${path}`;
		const hit = cache.get(key);
		if (hit && Date.now() - hit.at < ttlMs) return hit.data;
		const snap = await db.ref(path).get();
		const data = snap.val() as unknown;
		cache.set(key, { at: Date.now(), data });
		return data;
	}
	const base = await resolveBaseUrl();
	if (!base) throw new Error("接続先のデータベースが見つかりません");
	return rtdbGet(base, path, ttlMs);
}

/* ===== 店舗名マッチング ===== */

function norm(s: string): string {
	return s.normalize("NFKC").replace(/\s+/g, "").trim();
}

type RtdbStores = Record<string, { name?: string }>;

function findStoreKey(storeName: string, rtdbStores: RtdbStores): string | null {
	const target = norm(storeName);
	if (!target) return null;
	const entries = Object.entries(rtdbStores).filter(([, v]) => typeof v?.name === "string");
	// 1) 正規化して完全一致
	const exact = entries.filter(([, v]) => norm(v.name!) === target);
	if (exact.length === 1) return exact[0][0];
	// 2) 既存アプリ側の名前がダッシュボード側の名前で終わる
	//    (例: 「秩父焼肉ホルモン酒場まる助 大宮一番街店」⇔「大宮一番街店」)
	const suffix = entries.filter(([, v]) => norm(v.name!).endsWith(target));
	if (suffix.length === 1) return suffix[0][0];
	// 3) 逆方向(ダッシュボード側がフルネームの場合)
	const reverse = entries.filter(([, v]) => target.endsWith(norm(v.name!)));
	if (reverse.length === 1) return reverse[0][0];
	return null; // 一致なし・複数一致は不採用(誤マッチ防止)
}

/* ===== 提出状況の取得 ===== */

type RtdbSubmission = {
	count?: number;
	total?: number;
	submittedAt?: string;
	photos?: unknown;
};

function photoCount(sub: RtdbSubmission | null): number {
	if (!sub) return 0;
	if (typeof sub.count === "number") return sub.count;
	const photos = sub.photos;
	if (Array.isArray(photos)) return photos.filter((p) => typeof p === "string" && p).length;
	if (photos && typeof photos === "object") {
		return Object.values(photos).filter((p) => typeof p === "string" && p).length;
	}
	return 0;
}

/**
 * 複数の候補キー(営業日 / カレンダー日)から提出データを読み、
 * 最も提出が進んでいる(枚数が多い、同数なら提出時刻が新しい)ものを返す。
 * 深夜 0 時をまたいでも「その営業の提出」を取りこぼさないための処理。
 */
async function readBestSubmission(
	basePath: string,
	keys: string[],
	ttlMs: number,
): Promise<RtdbSubmission | null> {
	const subs = (await Promise.all(
		keys.map((k) => readPath(`${basePath}/${k}`, ttlMs) as Promise<RtdbSubmission | null>),
	)) as (RtdbSubmission | null)[];
	let best: RtdbSubmission | null = null;
	let bestCount = -1;
	for (const sub of subs) {
		if (!sub) continue;
		const count = photoCount(sub);
		if (
			count > bestCount ||
			(count === bestCount && (sub.submittedAt ?? "") > (best?.submittedAt ?? ""))
		) {
			best = sub;
			bestCount = count;
		}
	}
	return best;
}

/* ===== 同期診断(管理画面 /admin/debug 用) ===== */

export type HygieneDiagnosis = {
	mode: "service-account" | "public-rest" | "off";
	rtdbUrl: string | null;
	probes: ProbeResult[];
	dailyKey: string;
	weeklyKey: string;
	dailyKeyCandidates: string[];
	dayCutoffHour: number;
	connection: { ok: boolean; error?: string };
	appStoreNames: string[];
	matches: {
		storeName: string;
		matchedKey: string | null;
		matchedName: string | null;
		daily: { count: number; total: number | null; submittedAt: string | null } | null;
		weekly: { count: number; total: number | null; submittedAt: string | null } | null;
		error?: string;
	}[];
};

export async function diagnoseHygiene(stores: Store[]): Promise<HygieneDiagnosis> {
	const envUrl = process.env.HYGIENE_RTDB_URL;
	const hasSA = !!process.env.HYGIENE_FIREBASE_SERVICE_ACCOUNT;

	let mode: HygieneDiagnosis["mode"];
	let url: string | null = null;
	let probes: ProbeResult[] = [];
	if (envUrl === "off") {
		mode = "off";
	} else if (hasSA) {
		mode = "service-account";
		url = envUrl ? envUrl.replace(/\/+$/, "") : V2_DB_URL;
	} else {
		mode = "public-rest";
		probes = envUrl ? [await probe(envUrl)] : await probeAll();
		url = envUrl ? envUrl.replace(/\/+$/, "") : pickUrl(probes);
	}

	const diagnosis: HygieneDiagnosis = {
		mode,
		rtdbUrl: url,
		probes,
		dailyKey: dailyKeyJST(),
		weeklyKey: weeklyKeyJST(),
		dailyKeyCandidates: dailyKeyCandidates(),
		dayCutoffHour: DAY_CUTOFF_HOUR,
		connection: { ok: false },
		appStoreNames: [],
		matches: [],
	};
	if (mode === "off") {
		diagnosis.connection.error = "HYGIENE_RTDB_URL が off に設定されています";
		return diagnosis;
	}
	if (mode === "public-rest" && !url) {
		diagnosis.connection.error =
			"どの候補 URL にも接続できませんでした(下の接続テスト結果を参照)";
		return diagnosis;
	}

	let rtdbStores: RtdbStores = {};
	try {
		rtdbStores = ((await readPath("stores", 0)) as RtdbStores) ?? {};
		diagnosis.connection.ok = true;
		diagnosis.appStoreNames = Object.values(rtdbStores)
			.map((v) => v?.name)
			.filter((n): n is string => typeof n === "string")
			.sort();
	} catch (e) {
		diagnosis.connection.error = e instanceof Error ? e.message : String(e);
		return diagnosis;
	}

	for (const store of stores) {
		const key = findStoreKey(store.name, rtdbStores);
		const entry: HygieneDiagnosis["matches"][number] = {
			storeName: store.name,
			matchedKey: key,
			matchedName: key ? rtdbStores[key]?.name ?? null : null,
			daily: null,
			weekly: null,
		};
		if (key) {
			try {
				const [daily, weekly] = await Promise.all([
					readBestSubmission(`submissions/${key}/daily`, dailyKeyCandidates(), 0),
					readBestSubmission(`submissions/${key}/weekly`, weeklyKeyCandidates(), 0),
				]);
				entry.daily = daily
					? { count: photoCount(daily), total: daily.total ?? null, submittedAt: daily.submittedAt ?? null }
					: null;
				entry.weekly = weekly
					? { count: photoCount(weekly), total: weekly.total ?? null, submittedAt: weekly.submittedAt ?? null }
					: null;
			} catch (e) {
				entry.error = e instanceof Error ? e.message : String(e);
			}
		}
		diagnosis.matches.push(entry);
	}

	return diagnosis;
}

/**
 * 既存衛生管理アプリから、渡した店舗の今日/今週の提出状況を取得する。
 * 取得できなかった店舗は結果に含まれない(呼び出し側でシート同期値にフォールバック)。
 */
export async function getLiveHygiene(stores: Store[]): Promise<Map<string, HygieneStatus>> {
	const result = new Map<string, HygieneStatus>();
	if (stores.length === 0 || process.env.HYGIENE_RTDB_URL === "off") return result;

	let rtdbStores: RtdbStores;
	try {
		rtdbStores = ((await readPath("stores", 10 * 60_000)) as RtdbStores) ?? {};
	} catch {
		return result; // アプリ側に到達できないときは全店フォールバック
	}

	const dailyKey = dailyKeyJST();
	const weeklyKey = weeklyKeyJST();
	const dailyKeys = dailyKeyCandidates();
	const weeklyKeys = weeklyKeyCandidates();

	await Promise.all(
		stores.map(async (store) => {
			const key = findStoreKey(store.name, rtdbStores);
			if (!key) return;
			try {
				const [daily, weekly] = await Promise.all([
					readBestSubmission(`submissions/${key}/daily`, dailyKeys, 2 * 60_000),
					readBestSubmission(`submissions/${key}/weekly`, weeklyKeys, 2 * 60_000),
				]);
				const times = [daily?.submittedAt, weekly?.submittedAt]
					.filter((t): t is string => typeof t === "string")
					.sort();
				result.set(store.id, {
					storeId: store.id,
					date: dailyKey,
					dailySubmitted: photoCount(daily),
					dailyRequired: daily?.total ?? DAILY_REQUIRED,
					weeklySubmitted: photoCount(weekly),
					weeklyRequired: weekly?.total ?? WEEKLY_REQUIRED,
					lastSubmittedAt: times[times.length - 1] ?? null,
				});
			} catch {
				// この店舗のみフォールバック
			}
		}),
	);

	return result;
}
