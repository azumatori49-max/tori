import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { oauthClient } from '@/lib/google';
import { upsertUser } from '@/lib/db';
import { setSession } from '@/lib/session';

export async function GET(req: NextRequest) {
	const appUrl = process.env.APP_URL || 'http://localhost:3000';
	const code = req.nextUrl.searchParams.get('code');
	if (!code) {
		return NextResponse.redirect(`${appUrl}/?error=auth_denied`);
	}
	try {
		const client = oauthClient();
		const { tokens } = await client.getToken(code);
		client.setCredentials(tokens);

		const oauth2 = google.oauth2({ version: 'v2', auth: client });
		const { data: profile } = await oauth2.userinfo.get();
		if (!profile.id || !profile.email) {
			return NextResponse.redirect(`${appUrl}/?error=no_profile`);
		}

		const user = upsertUser({
			googleId: profile.id,
			email: profile.email,
			name: profile.name ?? profile.email,
			picture: profile.picture ?? '',
			refreshToken: tokens.refresh_token ?? undefined,
		});
		await setSession(user.id);
		return NextResponse.redirect(`${appUrl}/dashboard`);
	} catch (err) {
		console.error('OAuth callback failed:', err);
		return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
	}
}
