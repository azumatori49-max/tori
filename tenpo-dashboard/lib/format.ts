const TZ = "Asia/Tokyo";

/** 小数 1 桁で表示 */
export function fmt1(n: number | null | undefined): string {
	if (n === null || n === undefined) return "-";
	return n.toFixed(1);
}

/** 小数 2 桁で表示(5 点満点の KPI 用) */
export function fmt2(n: number | null | undefined): string {
	if (n === null || n === undefined) return "-";
	return n.toFixed(2);
}

/** ISO → 2026/06/20 22:26 (JST) */
export function fmtDateTime(iso: string | null | undefined): string {
	if (!iso) return "-";
	const d = new Date(iso);
	const parts = new Intl.DateTimeFormat("ja-JP", {
		timeZone: TZ,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(d);
	return parts.replace(/‎/g, "");
}

/** YYYY-MM-DD → 6/20 */
export function fmtMD(dateStr: string): string {
	const [, m, d] = dateStr.split("-");
	return `${Number(m)}/${Number(d)}`;
}

/** ISO → 6/18 (JST) */
export function fmtMDFromIso(iso: string): string {
	const d = new Date(iso);
	const parts = new Intl.DateTimeFormat("ja-JP", {
		timeZone: TZ,
		month: "numeric",
		day: "numeric",
	}).formatToParts(d);
	const m = parts.find((p) => p.type === "month")?.value;
	const day = parts.find((p) => p.type === "day")?.value;
	return `${m}/${day}`;
}

export function isNew(iso: string, days = 7): boolean {
	return Date.now() - new Date(iso).getTime() < days * 86400_000;
}

export type SubmitState = {
	label: string;
	tone: "good" | "warn" | "bad";
};

export function submitState(submitted: number, required: number): SubmitState {
	if (submitted >= required) return { label: "提出済", tone: "good" };
	if (submitted === 0) return { label: "未提出", tone: "bad" };
	return { label: "一部提出", tone: "warn" };
}
