import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
	title: '日程調整アプリ',
	description: 'Google カレンダー連動の日程調整・面接予約アプリ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ja">
			<body>{children}</body>
		</html>
	);
}
