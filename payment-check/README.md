# Payment Check（入金チェックシステム）

会員の月ごとの入金状況を管理者がチェック・管理するためのWebアプリです。

## 機能

- **管理者ログイン** — メールアドレス + パスワードによる認証（署名付きセッションCookie）
- **ダッシュボード** — 当月の対象会員数 / 入金済み / 未入金 / 入金合計と最近の入金履歴
- **入金チェック** — 月を切り替えながら会員ごとの入金状況をワンクリックで「入金確認 / 未入金に戻す」、金額の修正も可能
- **会員管理** — 会員の追加・編集・削除、月額料金・有効/無効の設定

## 技術構成

- Next.js 14（App Router / Server Actions）+ TypeScript
- Tailwind CSS
- SQLite（better-sqlite3、`data/payment-check.db` に自動作成）

## セットアップ

```bash
cd payment-check
npm install
npm run dev
```

http://localhost:3000 を開くとログイン画面が表示されます。

## 管理者アカウント

初回起動時に以下の管理者アカウントが自動作成されます。

| 項目 | 値 |
| --- | --- |
| メールアドレス | admin@toriyaro.com |
| パスワード | toriyaro@1234 |

環境変数 `ADMIN_EMAIL` / `ADMIN_PASSWORD` を設定して初回起動すると、そのアカウントで作成されます（作成済みのDBがある場合は変更されません）。

## 環境変数（任意）

| 変数 | 説明 |
| --- | --- |
| `ADMIN_EMAIL` | 初期管理者のメールアドレス |
| `ADMIN_PASSWORD` | 初期管理者のパスワード |
| `SESSION_SECRET` | セッションCookieの署名キー（本番では必ず設定してください） |

## 注意（Vercelへのデプロイについて）

データ保存にファイルベースのSQLiteを使用しているため、そのままではVercelのようなサーバーレス環境ではデータが永続化されません。Vercelへデプロイする場合は、Vercel Postgres / Supabase / Turso などの外部データベースへの置き換えが必要です。
