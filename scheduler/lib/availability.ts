import type { EventType, User } from './db';
import { clientForUser, fetchBusyIntervals } from './google';
import { computeSlots, type WeeklyAvailability } from './slots';

export type DaySlots = { date: string; dow: number; slots: { start: string; end: string }[] };

// イベント種別と主催者から、現在予約可能な枠を計算する
export async function getAvailableSlots(eventType: EventType, owner: User): Promise<DaySlots[]> {
	const auth = clientForUser(owner);
	const now = new Date();
	const timeMax = new Date(now.getTime() + (eventType.days_ahead + 1) * 86_400_000);
	const busy = await fetchBusyIntervals(auth, now, timeMax);
	const availability = JSON.parse(eventType.availability) as WeeklyAvailability;
	return computeSlots({
		timezone: owner.timezone,
		availability,
		durationMin: eventType.duration_min,
		bufferMin: eventType.buffer_min,
		minNoticeMin: eventType.min_notice_min,
		daysAhead: eventType.days_ahead,
		busy,
		now,
	});
}
