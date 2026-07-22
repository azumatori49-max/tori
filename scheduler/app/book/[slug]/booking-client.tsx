'use client';

import { useEffect, useMemo, useState } from 'react';

type Slot = { start: string; end: string };
type Day = { date: string; dow: number; slots: Slot[] };
type AvailabilityResponse = {
	eventType: {
		title: string;
		description: string;
		durationMin: number;
		timezone: string;
		hostName: string;
	};
	days: Day[];
	error?: string;
};

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export default function BookingClient({ slug }: { slug: string }) {
	const [data, setData] = useState<AvailabilityResponse | null>(null);
	const [loadError, setLoadError] = useState('');
	const [selectedDate, setSelectedDate] = useState('');
	const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
	const [guestName, setGuestName] = useState('');
	const [guestEmail, setGuestEmail] = useState('');
	const [note, setNote] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState('');
	const [done, setDone] = useState<{ start: string; meetUrl: string; mailSent: boolean } | null>(
		null,
	);

	useEffect(() => {
		(async () => {
			const res = await fetch(`/api/availability?slug=${encodeURIComponent(slug)}`);
			const json = await res.json();
			if (!res.ok) {
				setLoadError(json.error ?? '読み込みに失敗しました');
				return;
			}
			setData(json);
			const firstDay = (json as AvailabilityResponse).days.find((d) => d.slots.length > 0);
			if (firstDay) setSelectedDate(firstDay.date);
		})();
	}, [slug]);

	const currentDay = useMemo(
		() => data?.days.find((d) => d.date === selectedDate),
		[data, selectedDate],
	);

	const formatTime = (iso: string) =>
		new Intl.DateTimeFormat('ja-JP', {
			timeZone: data?.eventType.timezone ?? 'Asia/Tokyo',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(iso));

	const formatFull = (iso: string) =>
		new Intl.DateTimeFormat('ja-JP', {
			timeZone: data?.eventType.timezone ?? 'Asia/Tokyo',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(iso));

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedSlot) return;
		setSubmitting(true);
		setSubmitError('');
		const res = await fetch('/api/bookings', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				slug,
				start: selectedSlot.start,
				guestName,
				guestEmail,
				note,
			}),
		});
		const json = await res.json().catch(() => ({}));
		setSubmitting(false);
		if (!res.ok) {
			setSubmitError(json.error ?? '予約に失敗しました');
			if (res.status === 409) {
				// 枠が埋まっていた場合は最新の空き状況を取り直す
				setSelectedSlot(null);
				const refresh = await fetch(`/api/availability?slug=${encodeURIComponent(slug)}`);
				if (refresh.ok) setData(await refresh.json());
			}
			return;
		}
		setDone({ start: json.start, meetUrl: json.meetUrl, mailSent: json.mailSent });
	};

	if (loadError) {
		return (
			<div className="container" style={{ maxWidth: 560 }}>
				<div className="card">
					<p className="error">{loadError}</p>
				</div>
			</div>
		);
	}

	if (!data) {
		return <div className="container">読み込み中...</div>;
	}

	if (done) {
		return (
			<div className="container" style={{ maxWidth: 560 }}>
				<div className="card" style={{ textAlign: 'center', padding: 40 }}>
					<h1 className="success">✅ 予約が確定しました</h1>
					<p style={{ margin: '16px 0' }}>
						<strong>{data.eventType.title}</strong>
						<br />
						{formatFull(done.start)}({data.eventType.durationMin}分)
					</p>
					{done.meetUrl && (
						<p style={{ marginBottom: 16 }}>
							面接リンク:{' '}
							<a href={done.meetUrl} target="_blank">
								{done.meetUrl}
							</a>
						</p>
					)}
					<p className="muted">
						{done.mailSent
							? `確認メールを ${guestEmail} 宛にお送りしました。`
							: 'カレンダー招待をお送りしました。メールをご確認ください。'}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="container" style={{ maxWidth: 720 }}>
			<div className="card">
				<h1>{data.eventType.title}</h1>
				<p className="muted">
					{data.eventType.hostName} / {data.eventType.durationMin}分 / 時刻は{' '}
					{data.eventType.timezone} 表示
				</p>
				{data.eventType.description && <p style={{ marginTop: 8 }}>{data.eventType.description}</p>}
			</div>

			<div className="card">
				<h2>1. 日付を選ぶ</h2>
				<div className="day-list">
					{data.days.map((d) => (
						<button
							key={d.date}
							type="button"
							className={`day-btn ${selectedDate === d.date ? 'selected' : ''}`}
							disabled={d.slots.length === 0}
							onClick={() => {
								setSelectedDate(d.date);
								setSelectedSlot(null);
							}}
						>
							<div className="dow">{DOW_LABELS[d.dow]}</div>
							<div className="num">{Number(d.date.slice(8, 10))}</div>
							<div className="count">{d.slots.length > 0 ? `${d.slots.length}枠` : '×'}</div>
						</button>
					))}
				</div>
			</div>

			{currentDay && (
				<div className="card">
					<h2>2. 時間を選ぶ</h2>
					<div className="slot-grid">
						{currentDay.slots.map((s) => (
							<button
								key={s.start}
								type="button"
								className={`slot-btn ${selectedSlot?.start === s.start ? 'selected' : ''}`}
								onClick={() => setSelectedSlot(s)}
							>
								{formatTime(s.start)}
							</button>
						))}
					</div>
				</div>
			)}

			{selectedSlot && (
				<div className="card">
					<h2>3. 情報を入力して予約</h2>
					<p style={{ marginBottom: 16 }}>
						選択中: <strong>{formatFull(selectedSlot.start)}</strong>(
						{data.eventType.durationMin}分)
					</p>
					<form onSubmit={submit}>
						<div className="row">
							<div className="field">
								<label>お名前</label>
								<input value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
							</div>
							<div className="field">
								<label>メールアドレス</label>
								<input
									type="email"
									value={guestEmail}
									onChange={(e) => setGuestEmail(e.target.value)}
									required
								/>
							</div>
						</div>
						<div className="field">
							<label>メモ(任意)</label>
							<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
						</div>
						{submitError && <p className="error">{submitError}</p>}
						<button className="btn" type="submit" disabled={submitting}>
							{submitting ? '予約処理中...' : 'この日時で予約する'}
						</button>
						<p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
							予約が確定すると、Google Meet の面接リンク付き確認メールが自動で届きます。
						</p>
					</form>
				</div>
			)}
		</div>
	);
}
