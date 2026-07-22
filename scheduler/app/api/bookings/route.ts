import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createBooking, getEventTypeBySlug, getUserById } from '@/lib/db';
import { getAvailableSlots } from '@/lib/availability';
import { clientForUser, createMeetEvent, sendMail } from '@/lib/google';

const bookingSchema = z.object({
	slug: z.string().min(1),
	start: z.string().datetime(),
	guestName: z.string().min(1).max(100),
	guestEmail: z.string().email().max(200),
	note: z.string().max(2000).default(''),
});

function formatJst(iso: string, timezone: string): string {
	return new Intl.DateTimeFormat('ja-JP', {
		timeZone: timezone,
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(iso));
}

export async function POST(req: NextRequest) {
	const parsed = bookingSchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: '入力内容が不正です' }, { status: 400 });
	}
	const input = parsed.data;

	const eventType = getEventTypeBySlug(input.slug);
	if (!eventType) {
		return NextResponse.json({ error: '予約ページが見つかりません' }, { status: 404 });
	}
	const owner = getUserById(eventType.user_id);
	if (!owner || !owner.refresh_token) {
		return NextResponse.json(
			{ error: '主催者の Google カレンダー連携が無効です' },
			{ status: 503 },
		);
	}

	// 提示した空き枠に含まれる時刻かをサーバー側で再検証する(二重予約・任意時刻の予約を防ぐ)
	let days;
	try {
		days = await getAvailableSlots(eventType, owner);
	} catch (err) {
		console.error('availability recheck failed:', err);
		return NextResponse.json({ error: '空き状況の確認に失敗しました' }, { status: 502 });
	}
	const requestedStart = new Date(input.start).toISOString();
	const slot = days.flatMap((d) => d.slots).find((s) => s.start === requestedStart);
	if (!slot) {
		return NextResponse.json(
			{ error: 'この時間枠は埋まってしまいました。別の枠をお選びください。' },
			{ status: 409 },
		);
	}

	const auth = clientForUser(owner);
	const startLabel = formatJst(slot.start, owner.timezone);

	let calendarResult;
	try {
		calendarResult = await createMeetEvent(auth, {
			summary: `${eventType.title} - ${input.guestName}様`,
			description: [
				`予約者: ${input.guestName} <${input.guestEmail}>`,
				input.note ? `メモ:\n${input.note}` : '',
			]
				.filter(Boolean)
				.join('\n\n'),
			startUtc: slot.start,
			endUtc: slot.end,
			timezone: owner.timezone,
			guestEmail: input.guestEmail,
			guestName: input.guestName,
		});
	} catch (err) {
		console.error('calendar event creation failed:', err);
		return NextResponse.json({ error: '予定の作成に失敗しました' }, { status: 502 });
	}

	const booking = createBooking({
		eventTypeId: eventType.id,
		guestName: input.guestName,
		guestEmail: input.guestEmail,
		note: input.note,
		startUtc: slot.start,
		endUtc: slot.end,
		meetUrl: calendarResult.meetUrl,
		calendarEventId: calendarResult.eventId,
	});

	// 確認メール(面接リンク付き)を自動送信。失敗しても予約自体は成立させる。
	let mailSent = true;
	try {
		const meetLine = calendarResult.meetUrl
			? `■ 面接リンク (Google Meet): ${calendarResult.meetUrl}\n`
			: '';
		const body =
			`${input.guestName} 様\n\n` +
			`「${eventType.title}」のご予約が確定しました。\n\n` +
			`■ 日時: ${startLabel}(${eventType.duration_min}分)\n` +
			`■ 担当: ${owner.name}\n` +
			meetLine +
			`\n当日は上記リンクからご参加ください。\n` +
			`Google カレンダーの招待も別途お送りしています。\n\n` +
			`※このメールは自動送信です。`;
		await sendMail(auth, {
			fromName: owner.name,
			to: input.guestEmail,
			subject: `【予約確定】${eventType.title} - ${startLabel}`,
			body,
		});
	} catch (err) {
		console.error('confirmation mail failed:', err);
		mailSent = false;
	}

	return NextResponse.json(
		{
			bookingId: booking.id,
			start: slot.start,
			end: slot.end,
			meetUrl: calendarResult.meetUrl,
			mailSent,
		},
		{ status: 201 },
	);
}
