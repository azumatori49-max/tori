import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/session';
import { createEventType, getEventTypeBySlug } from '@/lib/db';

const timeRangeSchema = z.object({
	start: z.string().regex(/^\d{1,2}:\d{2}$/),
	end: z.string().regex(/^\d{1,2}:\d{2}$/),
});

const createSchema = z.object({
	title: z.string().min(1).max(100),
	description: z.string().max(1000).default(''),
	slug: z
		.string()
		.min(1)
		.max(60)
		.regex(/^[a-z0-9-]+$/, 'slug は半角英小文字・数字・ハイフンのみ'),
	durationMin: z.number().int().min(5).max(480),
	bufferMin: z.number().int().min(0).max(120).default(0),
	minNoticeMin: z.number().int().min(0).max(10080).default(60),
	daysAhead: z.number().int().min(1).max(60).default(14),
	availability: z.record(z.string().regex(/^[0-6]$/), z.array(timeRangeSchema)),
});

export async function POST(req: NextRequest) {
	const user = await getSessionUser();
	if (!user) {
		return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
	}
	const parsed = createSchema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: '入力内容が不正です', details: parsed.error.flatten() },
			{ status: 400 },
		);
	}
	const input = parsed.data;
	const hasRange = Object.values(input.availability).some((ranges) => ranges.length > 0);
	if (!hasRange) {
		return NextResponse.json(
			{ error: '受付可能な時間帯を 1 つ以上設定してください' },
			{ status: 400 },
		);
	}
	if (getEventTypeBySlug(input.slug)) {
		return NextResponse.json(
			{ error: 'この URL(slug)は既に使われています' },
			{ status: 409 },
		);
	}
	const eventType = createEventType({
		userId: user.id,
		slug: input.slug,
		title: input.title,
		description: input.description,
		durationMin: input.durationMin,
		bufferMin: input.bufferMin,
		minNoticeMin: input.minNoticeMin,
		daysAhead: input.daysAhead,
		availability: JSON.stringify(input.availability),
	});
	return NextResponse.json({ id: eventType.id, slug: eventType.slug }, { status: 201 });
}
