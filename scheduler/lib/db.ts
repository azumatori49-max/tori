import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = process.env.DATABASE_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'scheduler.db'));
db.pragma('journal_mode = WAL');

db.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		google_id TEXT NOT NULL UNIQUE,
		email TEXT NOT NULL,
		name TEXT NOT NULL DEFAULT '',
		picture TEXT NOT NULL DEFAULT '',
		refresh_token TEXT,
		timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS event_types (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id),
		slug TEXT NOT NULL UNIQUE,
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		duration_min INTEGER NOT NULL DEFAULT 30,
		buffer_min INTEGER NOT NULL DEFAULT 0,
		min_notice_min INTEGER NOT NULL DEFAULT 60,
		days_ahead INTEGER NOT NULL DEFAULT 14,
		availability TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS bookings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		event_type_id INTEGER NOT NULL REFERENCES event_types(id),
		guest_name TEXT NOT NULL,
		guest_email TEXT NOT NULL,
		note TEXT NOT NULL DEFAULT '',
		start_utc TEXT NOT NULL,
		end_utc TEXT NOT NULL,
		meet_url TEXT NOT NULL DEFAULT '',
		calendar_event_id TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);
`);

export type User = {
	id: number;
	google_id: string;
	email: string;
	name: string;
	picture: string;
	refresh_token: string | null;
	timezone: string;
};

export type EventType = {
	id: number;
	user_id: number;
	slug: string;
	title: string;
	description: string;
	duration_min: number;
	buffer_min: number;
	min_notice_min: number;
	days_ahead: number;
	availability: string;
};

export type Booking = {
	id: number;
	event_type_id: number;
	guest_name: string;
	guest_email: string;
	note: string;
	start_utc: string;
	end_utc: string;
	meet_url: string;
	calendar_event_id: string;
	created_at: string;
};

export function upsertUser(input: {
	googleId: string;
	email: string;
	name: string;
	picture: string;
	refreshToken?: string;
}): User {
	const existing = db
		.prepare('SELECT * FROM users WHERE google_id = ?')
		.get(input.googleId) as User | undefined;
	if (existing) {
		db.prepare(
			`UPDATE users SET email = ?, name = ?, picture = ?,
			 refresh_token = COALESCE(?, refresh_token) WHERE id = ?`,
		).run(input.email, input.name, input.picture, input.refreshToken ?? null, existing.id);
	} else {
		db.prepare(
			`INSERT INTO users (google_id, email, name, picture, refresh_token)
			 VALUES (?, ?, ?, ?, ?)`,
		).run(input.googleId, input.email, input.name, input.picture, input.refreshToken ?? null);
	}
	return db.prepare('SELECT * FROM users WHERE google_id = ?').get(input.googleId) as User;
}

export function getUserById(id: number): User | undefined {
	return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function listEventTypes(userId: number): EventType[] {
	return db
		.prepare('SELECT * FROM event_types WHERE user_id = ? ORDER BY id DESC')
		.all(userId) as EventType[];
}

export function getEventTypeBySlug(slug: string): EventType | undefined {
	return db.prepare('SELECT * FROM event_types WHERE slug = ?').get(slug) as
		| EventType
		| undefined;
}

export function createEventType(input: {
	userId: number;
	slug: string;
	title: string;
	description: string;
	durationMin: number;
	bufferMin: number;
	minNoticeMin: number;
	daysAhead: number;
	availability: string;
}): EventType {
	const result = db
		.prepare(
			`INSERT INTO event_types
			 (user_id, slug, title, description, duration_min, buffer_min, min_notice_min, days_ahead, availability)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			input.userId,
			input.slug,
			input.title,
			input.description,
			input.durationMin,
			input.bufferMin,
			input.minNoticeMin,
			input.daysAhead,
			input.availability,
		);
	return db
		.prepare('SELECT * FROM event_types WHERE id = ?')
		.get(result.lastInsertRowid) as EventType;
}

export function deleteEventType(userId: number, id: number): void {
	db.prepare('DELETE FROM event_types WHERE id = ? AND user_id = ?').run(id, userId);
}

export function createBooking(input: {
	eventTypeId: number;
	guestName: string;
	guestEmail: string;
	note: string;
	startUtc: string;
	endUtc: string;
	meetUrl: string;
	calendarEventId: string;
}): Booking {
	const result = db
		.prepare(
			`INSERT INTO bookings
			 (event_type_id, guest_name, guest_email, note, start_utc, end_utc, meet_url, calendar_event_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			input.eventTypeId,
			input.guestName,
			input.guestEmail,
			input.note,
			input.startUtc,
			input.endUtc,
			input.meetUrl,
			input.calendarEventId,
		);
	return db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid) as Booking;
}

export function listBookingsForUser(userId: number): (Booking & { event_title: string })[] {
	return db
		.prepare(
			`SELECT b.*, e.title AS event_title
			 FROM bookings b JOIN event_types e ON e.id = b.event_type_id
			 WHERE e.user_id = ? ORDER BY b.start_utc DESC`,
		)
		.all(userId) as (Booking & { event_title: string })[];
}
