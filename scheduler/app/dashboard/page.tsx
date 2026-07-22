'use client';

import { useCallback, useEffect, useState } from 'react';

type TimeRange = { start: string; end: string };
type Availability = Record<string, TimeRange[]>;

type Me = {
	user: { id: number; email: string; name: string; picture: string; connected: boolean } | null;
	eventTypes: {
		id: number;
		slug: string;
		title: string;
		durationMin: number;
		daysAhead: number;
	}[];
	bookings: {
		id: number;
		eventTitle: string;
		guestName: string;
		guestEmail: string;
		startUtc: string;
		meetUrl: string;
	}[];
};

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function defaultAvailability(): Availability {
	const a: Availability = {};
	for (let i = 0; i < 7; i++) {
		a[String(i)] = i >= 1 && i <= 5 ? [{ start: '10:00', end: '18:00' }] : [];
	}
	return a;
}

export default function DashboardPage() {
	const [me, setMe] = useState<Me | null>(null);
	const [loading, setLoading] = useState(true);

	const [title, setTitle] = useState('一次面接');
	const [slug, setSlug] = useState('');
	const [description, setDescription] = useState('');
	const [durationMin, setDurationMin] = useState(30);
	const [daysAhead, setDaysAhead] = useState(14);
	const [availability, setAvailability] = useState<Availability>(defaultAvailability);
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState('');
	const [copied, setCopied] = useState('');

	const load = useCallback(async () => {
		setLoading(true);
		const res = await fetch('/api/me');
		if (res.status === 401) {
			window.location.href = '/';
			return;
		}
		setMe(await res.json());
		setLoading(false);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const toggleDay = (dow: string, enabled: boolean) => {
		setAvailability((prev) => ({
			...prev,
			[dow]: enabled ? [{ start: '10:00', end: '18:00' }] : [],
		}));
	};

	const setRange = (dow: string, key: 'start' | 'end', value: string) => {
		setAvailability((prev) => ({
			...prev,
			[dow]: prev[dow].map((r, i) => (i === 0 ? { ...r, [key]: value } : r)),
		}));
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError('');
		setSaving(true);
		const res = await fetch('/api/event-types', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title,
				slug: slug.trim().toLowerCase(),
				description,
				durationMin,
				daysAhead,
				availability,
			}),
		});
		setSaving(false);
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			setFormError(data.error ?? '保存に失敗しました');
			return;
		}
		setTitle('一次面接');
		setSlug('');
		setDescription('');
		await load();
	};

	const remove = async (id: number) => {
		if (!confirm('この予約ページを削除しますか?')) return;
		await fetch(`/api/event-types/${id}`, { method: 'DELETE' });
		await load();
	};

	const copyLink = async (s: string) => {
		const url = `${window.location.origin}/book/${s}`;
		await navigator.clipboard.writeText(url);
		setCopied(s);
		setTimeout(() => setCopied(''), 2000);
	};

	const logout = async () => {
		await fetch('/api/logout', { method: 'POST' });
		window.location.href = '/';
	};

	if (loading || !me?.user) {
		return <div className="container">読み込み中...</div>;
	}

	return (
		<div className="container">
			<div className="header">
				<div>
					<h1>ダッシュボード</h1>
					<p className="muted">
						{me.user.name}({me.user.email})
						{me.user.connected && <span className="badge" style={{ marginLeft: 8 }}>カレンダー連携済み</span>}
					</p>
				</div>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					{me.user.picture && <img className="avatar" src={me.user.picture} alt="" />}
					<button className="btn btn-outline" onClick={logout}>
						ログアウト
					</button>
				</div>
			</div>

			<div className="card">
				<h2>予約ページ一覧</h2>
				{me.eventTypes.length === 0 && (
					<p className="muted">まだ予約ページがありません。下のフォームから作成してください。</p>
				)}
				{me.eventTypes.map((e) => (
					<div key={e.id} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
							<div>
								<strong>{e.title}</strong>
								<span className="muted" style={{ marginLeft: 8 }}>
									{e.durationMin}分 / {e.daysAhead}日先まで
								</span>
							</div>
							<button className="btn-danger btn" onClick={() => remove(e.id)}>
								削除
							</button>
						</div>
						<div className="copy-link">
							<code>{typeof window !== 'undefined' ? `${window.location.origin}/book/${e.slug}` : `/book/${e.slug}`}</code>
							<button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => copyLink(e.slug)}>
								{copied === e.slug ? 'コピーしました ✓' : 'リンクをコピー'}
							</button>
							<a href={`/book/${e.slug}`} target="_blank" style={{ fontSize: 13 }}>
								プレビュー ↗
							</a>
						</div>
					</div>
				))}
			</div>

			<div className="card">
				<h2>新しい予約ページを作成</h2>
				<form onSubmit={submit}>
					<div className="row">
						<div className="field">
							<label>タイトル</label>
							<input value={title} onChange={(e) => setTitle(e.target.value)} required />
						</div>
						<div className="field">
							<label>URL(半角英数字とハイフン)</label>
							<input
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								placeholder="interview-30min"
								pattern="[a-z0-9\-]+"
								required
							/>
						</div>
					</div>
					<div className="field">
						<label>説明(任意)</label>
						<textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={2}
							placeholder="オンライン面接です。Google Meet で行います。"
						/>
					</div>
					<div className="row">
						<div className="field">
							<label>所要時間(分)</label>
							<select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
								{[15, 30, 45, 60, 90].map((m) => (
									<option key={m} value={m}>
										{m}分
									</option>
								))}
							</select>
						</div>
						<div className="field">
							<label>何日先まで受け付けるか</label>
							<select value={daysAhead} onChange={(e) => setDaysAhead(Number(e.target.value))}>
								{[7, 14, 30, 60].map((d) => (
									<option key={d} value={d}>
										{d}日
									</option>
								))}
							</select>
						</div>
					</div>
					<div className="field">
						<label>受付可能な曜日と時間帯</label>
						{DOW_LABELS.map((label, dow) => {
							const key = String(dow);
							const range = availability[key][0];
							return (
								<div key={dow} className="weekday-row">
									<label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
										<input
											type="checkbox"
											style={{ width: 'auto' }}
											checked={Boolean(range)}
											onChange={(e) => toggleDay(key, e.target.checked)}
										/>
										<span className="name">{label}</span>
									</label>
									{range && (
										<>
											<input type="time" value={range.start} onChange={(e) => setRange(key, 'start', e.target.value)} />
											<span>〜</span>
											<input type="time" value={range.end} onChange={(e) => setRange(key, 'end', e.target.value)} />
										</>
									)}
								</div>
							);
						})}
					</div>
					{formError && <p className="error">{formError}</p>}
					<button className="btn" type="submit" disabled={saving}>
						{saving ? '作成中...' : '予約ページを作成'}
					</button>
				</form>
			</div>

			<div className="card">
				<h2>予約一覧</h2>
				{me.bookings.length === 0 ? (
					<p className="muted">まだ予約はありません。</p>
				) : (
					<div style={{ overflowX: 'auto' }}>
						<table>
							<thead>
								<tr>
									<th>日時</th>
									<th>イベント</th>
									<th>予約者</th>
									<th>Meet</th>
								</tr>
							</thead>
							<tbody>
								{me.bookings.map((b) => (
									<tr key={b.id}>
										<td>
											{new Intl.DateTimeFormat('ja-JP', {
												month: 'numeric',
												day: 'numeric',
												weekday: 'short',
												hour: '2-digit',
												minute: '2-digit',
											}).format(new Date(b.startUtc))}
										</td>
										<td>{b.eventTitle}</td>
										<td>
											{b.guestName}
											<br />
											<span className="muted">{b.guestEmail}</span>
										</td>
										<td>
											{b.meetUrl ? (
												<a href={b.meetUrl} target="_blank">
													参加リンク
												</a>
											) : (
												'-'
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
