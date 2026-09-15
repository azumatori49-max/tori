import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "入金確認システム",
  description: "本部の入金確認・照合システム",
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
