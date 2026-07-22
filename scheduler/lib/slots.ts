// 空き枠計算ロジック。タイムゾーンは Intl API で扱い、外部ライブラリに依存しない。

export type TimeRange = { start: string; end: string }; // "HH:mm"
export type WeeklyAvailability = Record<string, TimeRange[]>; // key: 曜日 "0"(日)〜"6"(土)
export type Interval = { start: Date; end: Date };
export type Slot = { start: string; end: string }; // ISO 8601 (UTC)

// 指定タイムゾーンの UTC からのオフセット(ミリ秒)を返す
function tzOffsetMs(timeZone: string, date: Date): number {
	const dtf = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
	const parts: Record<string, string> = {};
	for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
	const asUtc = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour) % 24,
		Number(parts.minute),
		Number(parts.second),
	);
	return asUtc - date.getTime();
}

// タイムゾーン上の壁時計時刻 (y-m-d hh:mm) を UTC の Date に変換する
export function wallTimeToUtc(
	timeZone: string,
	y: number,
	m: number,
	d: number,
	hh: number,
	mm: number,
): Date {
	let ts = Date.UTC(y, m - 1, d, hh, mm);
	// DST 境界を考慮して 2 回補正する(日本は DST なしのため 1 回で収束)
	for (let i = 0; i < 2; i++) {
		ts = Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMs(timeZone, new Date(ts));
	}
	return new Date(ts);
}

// 指定タイムゾーンでの「今日」の日付と曜日を返す
export function dateInTz(timeZone: string, date: Date): { y: number; m: number; d: number; dow: number } {
	const dtf = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		weekday: 'short',
	});
	const parts: Record<string, string> = {};
	for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
	const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
	return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), dow };
}

function parseHm(s: string): { h: number; m: number } | null {
	const match = /^(\d{1,2}):(\d{2})$/.exec(s);
	if (!match) return null;
	const h = Number(match[1]);
	const m = Number(match[2]);
	if (h > 23 || m > 59) return null;
	return { h, m };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
	return aStart < bEnd && bStart < aEnd;
}

export type SlotOptions = {
	timezone: string;
	availability: WeeklyAvailability;
	durationMin: number;
	bufferMin: number;
	minNoticeMin: number;
	daysAhead: number;
	busy: Interval[];
	now?: Date;
};

// 予約可能な枠を日付(主催者タイムゾーン)ごとにグルーピングして返す
export function computeSlots(opts: SlotOptions): { date: string; dow: number; slots: Slot[] }[] {
	const now = opts.now ?? new Date();
	const earliest = new Date(now.getTime() + opts.minNoticeMin * 60_000);
	const stepMs = opts.durationMin * 60_000;
	const bufferMs = opts.bufferMin * 60_000;
	const days: { date: string; dow: number; slots: Slot[] }[] = [];

	// 主催者タイムゾーンでの今日を起点に daysAhead 日分を走査する
	const startOfTodayUtc = (() => {
		const t = dateInTz(opts.timezone, now);
		return wallTimeToUtc(opts.timezone, t.y, t.m, t.d, 0, 0);
	})();

	for (let i = 0; i < opts.daysAhead; i++) {
		// その日の正午(UTC 基準でずれない安全な時刻)からローカル日付を得る
		const probe = new Date(startOfTodayUtc.getTime() + i * 86_400_000 + 12 * 3_600_000);
		const local = dateInTz(opts.timezone, probe);
		const ranges = opts.availability[String(local.dow)] ?? [];
		const slots: Slot[] = [];

		for (const range of ranges) {
			const start = parseHm(range.start);
			const end = parseHm(range.end);
			if (!start || !end) continue;
			const rangeStart = wallTimeToUtc(opts.timezone, local.y, local.m, local.d, start.h, start.m);
			const rangeEnd = wallTimeToUtc(opts.timezone, local.y, local.m, local.d, end.h, end.m);

			for (let t = rangeStart.getTime(); t + stepMs <= rangeEnd.getTime(); t += stepMs) {
				const slotStart = new Date(t);
				const slotEnd = new Date(t + stepMs);
				if (slotStart < earliest) continue;
				const paddedStart = new Date(slotStart.getTime() - bufferMs);
				const paddedEnd = new Date(slotEnd.getTime() + bufferMs);
				const isBusy = opts.busy.some((b) => overlaps(paddedStart, paddedEnd, b.start, b.end));
				if (isBusy) continue;
				slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
			}
		}

		slots.sort((a, b) => a.start.localeCompare(b.start));
		const dateStr = `${local.y}-${String(local.m).padStart(2, '0')}-${String(local.d).padStart(2, '0')}`;
		days.push({ date: dateStr, dow: local.dow, slots });
	}

	return days;
}
