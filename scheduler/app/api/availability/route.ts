import { NextRequest, NextResponse } from 'next/server';
import { getEventTypeBySlug, getUserById } from '@/lib/db';
import { getAvailableSlots } from '@/lib/availability';

export async function GET(req: NextRequest) {
	const slug = req.nextUrl.searchParams.get('slug');
	if (!slug) {
		return NextResponse.json({ error: 'slug is required' }, { status: 400 });
	}
	const eventType = getEventTypeBySlug(slug);
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
	try {
		const days = await getAvailableSlots(eventType, owner);
		return NextResponse.json({
			eventType: {
				slug: eventType.slug,
				title: eventType.title,
				description: eventType.description,
				durationMin: eventType.duration_min,
				timezone: owner.timezone,
				hostName: owner.name,
			},
			days,
		});
	} catch (err) {
		console.error('availability failed:', err);
		return NextResponse.json({ error: '空き時間の取得に失敗しました' }, { status: 502 });
	}
}
