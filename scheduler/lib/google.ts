import { google, type Auth } from 'googleapis';
type OAuth2Client = Auth.OAuth2Client;
import type { User } from './db';
import type { Interval } from './slots';

export const OAUTH_SCOPES = [
	'openid',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.googleapis.com/auth/userinfo.profile',
	'https://www.googleapis.com/auth/calendar',
	'https://www.googleapis.com/auth/gmail.send',
];

export function oauthClient(): OAuth2Client {
	const clientId = process.env.GOOGLE_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
	const appUrl = process.env.APP_URL || 'http://localhost:3000';
	if (!clientId || !clientSecret) {
		throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET is not set');
	}
	return new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/auth/callback`);
}

export function buildAuthUrl(): string {
	return oauthClient().generateAuthUrl({
		access_type: 'offline',
		prompt: 'consent',
		scope: OAUTH_SCOPES,
	});
}

export function clientForUser(user: User): OAuth2Client {
	if (!user.refresh_token) {
		throw new Error('Google refresh token is missing; re-authentication required');
	}
	const client = oauthClient();
	client.setCredentials({ refresh_token: user.refresh_token });
	return client;
}

// 主催者のメインカレンダーの予定あり時間帯を取得する
export async function fetchBusyIntervals(
	auth: OAuth2Client,
	timeMin: Date,
	timeMax: Date,
): Promise<Interval[]> {
	const calendar = google.calendar({ version: 'v3', auth });
	const res = await calendar.freebusy.query({
		requestBody: {
			timeMin: timeMin.toISOString(),
			timeMax: timeMax.toISOString(),
			items: [{ id: 'primary' }],
		},
	});
	const busy = res.data.calendars?.primary?.busy ?? [];
	return busy
		.filter((b) => b.start && b.end)
		.map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
}

// Google Meet リンク付きの予定を作成し、ゲストを招待する
export async function createMeetEvent(
	auth: OAuth2Client,
	input: {
		summary: string;
		description: string;
		startUtc: string;
		endUtc: string;
		timezone: string;
		guestEmail: string;
		guestName: string;
	},
): Promise<{ eventId: string; meetUrl: string; htmlLink: string }> {
	const calendar = google.calendar({ version: 'v3', auth });
	const res = await calendar.events.insert({
		calendarId: 'primary',
		conferenceDataVersion: 1,
		sendUpdates: 'all',
		requestBody: {
			summary: input.summary,
			description: input.description,
			start: { dateTime: input.startUtc, timeZone: input.timezone },
			end: { dateTime: input.endUtc, timeZone: input.timezone },
			attendees: [{ email: input.guestEmail, displayName: input.guestName }],
			conferenceData: {
				createRequest: {
					requestId: `booking-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
					conferenceSolutionKey: { type: 'hangoutsMeet' },
				},
			},
			reminders: { useDefault: true },
		},
	});
	const meetUrl =
		res.data.hangoutLink ||
		res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
		'';
	return {
		eventId: res.data.id ?? '',
		meetUrl,
		htmlLink: res.data.htmlLink ?? '',
	};
}

// Gmail API で確認メールを送信する(日本語件名は RFC 2047 でエンコード)
export async function sendMail(
	auth: OAuth2Client,
	input: { fromName: string; to: string; subject: string; body: string },
): Promise<void> {
	const gmail = google.gmail({ version: 'v1', auth });
	const encodedSubject = `=?UTF-8?B?${Buffer.from(input.subject, 'utf8').toString('base64')}?=`;
	const encodedFromName = `=?UTF-8?B?${Buffer.from(input.fromName, 'utf8').toString('base64')}?=`;
	const message = [
		`From: ${encodedFromName} <me>`,
		`To: ${input.to}`,
		`Subject: ${encodedSubject}`,
		'MIME-Version: 1.0',
		'Content-Type: text/plain; charset=UTF-8',
		'Content-Transfer-Encoding: base64',
		'',
		Buffer.from(input.body, 'utf8').toString('base64'),
	].join('\r\n');
	await gmail.users.messages.send({
		userId: 'me',
		requestBody: { raw: Buffer.from(message, 'utf8').toString('base64url') },
	});
}
