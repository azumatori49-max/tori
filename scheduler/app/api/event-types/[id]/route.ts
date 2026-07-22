import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { deleteEventType } from '@/lib/db';

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const user = await getSessionUser();
	if (!user) {
		return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
	}
	const { id } = await params;
	deleteEventType(user.id, Number(id));
	return NextResponse.json({ ok: true });
}
