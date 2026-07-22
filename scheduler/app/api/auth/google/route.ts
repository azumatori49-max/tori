import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/google';

export async function GET() {
	return NextResponse.redirect(buildAuthUrl());
}
