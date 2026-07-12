// 既存の衛生管理アプリ(toriyaro-eisei / Firebase Realtime Database)から
// 提出状況をリアルタイムに読み取るモジュール。
//
// 既存アプリのデータ構造:
//   stores/{storeKey} = { name, password }
//   submissions/{storeKey}/daily/{YYYY-MM-DD}   = { count, total?, submittedAt, photos, storeName }
//   submissions/{storeKey}/weekly/{Wyyyy-mm-dd} = 同上(キーは週の月曜日)
//
// Realtime Database の URL はリージョンによって形式が異なるため、
// 候補 URL を順に試して繋がったものを使う(HYGIENE_RTDB_URL で固定も可能)。
// ダッシュボードの店舗とは「店舗名」で自動マッチングする。
import type { HygieneStatus, Store } from "./types";

const PROJECT = "toriyaro-eisei-faf2e";
const CANDIDATE_URLS = [
	`https://${PROJECT}-default-rtdb.firebaseio.com`,
	`https://${PROJECT}-default-rtdb.asia-southeast1.firebasedatabase.app`,
	`https://${PROJECT}-default-rtdb.europe-west1.firebasedatabase.app`,
	`https://${PROJECT}.firebaseio.com`,
];

const DAILY_REQUIRED = 7;
const WEEKLY_REQUIRED = 7;

/* ===== 接続先 URL の自動検出 ===== */

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

const pad = (n: number) => String(n).padStart(2, "0");

function jstDate(): Date {
	return new Date(Date.now() + 9 * 3600_000);
}

export function dailyKeyJST(): string {
	const d = jstDate();
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function weeklyKeyJST(): string {
	const d = jstDate();
	const dow = d.getUTCDay();
	d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow)); // その週の月曜日
	return `W${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
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

/* ===== 同期診断(管理画面 /admin/debug 用) ===== */

export type HygieneDiagnosis = {
	rtdbUrl: string | null;
	probes: ProbeResult[];
	dailyKey: string;
	weeklyKey: string;
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
	const probes = envUrl && envUrl !== "off" ? await Promise.all([probe(envUrl)]) : await probeAll();
	const url = envUrl && envUrl !== "off" ? envUrl.replace(/\/+$/, "") : pickUrl(probes);

	const diagnosis: HygieneDiagnosis = {
		rtdbUrl: url,
		probes,
		dailyKey: dailyKeyJST(),
		weeklyKey: weeklyKeyJST(),
		connection: { ok: false },
		appStoreNames: [],
		matches: [],
	};
	if (envUrl === "off") {
		diagnosis.connection.error = "HYGIENE_RTDB_URL が off に設定されています";
		return diagnosis;
	}
	if (!url) {
		diagnosis.connection.error =
			"どの候補 URL にも接続できませんでした(下の接続テスト結果を参照)";
		return diagnosis;
	}

	let rtdbStores: RtdbStores = {};
	try {
		rtdbStores = ((await rtdbGet(url, "stores", 0)) as RtdbStores) ?? {};
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
					rtdbGet(url, `submissions/${key}/daily/${diagnosis.dailyKey}`, 0) as Promise<RtdbSubmission | null>,
					rtdbGet(url, `submissions/${key}/weekly/${diagnosis.weeklyKey}`, 0) as Promise<RtdbSubmission | null>,
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
	if (stores.length === 0) return result;
	const base = await resolveBaseUrl();
	if (!base) return result;

	let rtdbStores: RtdbStores;
	try {
		rtdbStores = ((await rtdbGet(base, "stores", 10 * 60_000)) as RtdbStores) ?? {};
	} catch {
		return result; // アプリ側に到達できないときは全店フォールバック
	}

	const dailyKey = dailyKeyJST();
	const weeklyKey = weeklyKeyJST();

	await Promise.all(
		stores.map(async (store) => {
			const key = findStoreKey(store.name, rtdbStores);
			if (!key) return;
			try {
				const [daily, weekly] = await Promise.all([
					rtdbGet(base, `submissions/${key}/daily/${dailyKey}`, 2 * 60_000) as Promise<RtdbSubmission | null>,
					rtdbGet(base, `submissions/${key}/weekly/${weeklyKey}`, 2 * 60_000) as Promise<RtdbSubmission | null>,
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
