export default function HomePage() {
	return (
		<div className="container" style={{ maxWidth: 560, paddingTop: 80 }}>
			<div className="card" style={{ textAlign: 'center', padding: 40 }}>
				<h1 style={{ fontSize: 28 }}>📅 日程調整アプリ</h1>
				<p className="muted" style={{ margin: '12px 0 28px' }}>
					Google カレンダーの空き時間から、相手に日程を選んでもらえます。
					<br />
					予約が入ると Google Meet の面接リンク付きメールを自動送信します。
				</p>
				<a className="btn" href="/api/auth/google">
					Google でログインして始める
				</a>
				<p className="muted" style={{ marginTop: 20, fontSize: 12 }}>
					カレンダーの空き状況の参照・予定の作成・確認メールの送信のために
					<br />
					Google アカウントへのアクセスを許可してください。
				</p>
			</div>
		</div>
	);
}
