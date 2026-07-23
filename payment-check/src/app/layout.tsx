import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Payment Check | 入金チェックシステム",
  description: "会員の入金状況を管理するシステム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
