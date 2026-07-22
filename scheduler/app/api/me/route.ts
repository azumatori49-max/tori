import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { listBookingsForUser, listEventTypes } from '@/lib/db';

export async function GET() {
	const user = await getSessionUser();
	if (!user) {
		return NextResponse.json({ user: null }, { status: 401 });
	}
	return NextResponse.json({
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			picture: user.picture,
			timezone: user.timezone,
			connected: Boolean(user.refresh_token),
		},
		eventTypes: listEventTypes(user.id).map((e) => ({
			id: e.id,
			slug: e.slug,
			title: e.title,
			description: e.description,
			durationMin: e.duration_min,
			bufferMin: e.buffer_min,
			minNoticeMin: e.min_notice_min,
			daysAhead: e.days_ahead,
			availability: JSON.parse(e.availability),
		})),
		bookings: listBookingsForUser(user.id).map((b) => ({
			id: b.id,
			eventTitle: b.event_title,
			guestName: b.guest_name,
			guestEmail: b.guest_email,
			note: b.note,
			startUtc: b.start_utc,
			endUtc: b.end_utc,
			meetUrl: b.meet_url,
		})),
	});
}
