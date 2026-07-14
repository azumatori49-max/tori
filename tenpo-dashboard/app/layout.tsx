import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "らくらく店舗ダッシュボード",
	description: "鶏ヤロー・まる助・イザカラ・すし鳥酒場 店舗KPI・衛生管理ダッシュボード",
	// iPad で「ホーム画面に追加」したときのアイコン名(短縮表示)
	appleWebApp: { title: "らくらく店舗" },
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ja">
			<body>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link
					rel="stylesheet"
					href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap"
				/>
				{children}
			</body>
		</html>
	);
}
