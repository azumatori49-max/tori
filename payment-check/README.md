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
- データベース（環境変数で自動切り替え）
  - ローカル開発: SQLite（better-sqlite3、`data/payment-check.db` に自動作成）
  - 本番/Vercel: PostgreSQL（`DATABASE_URL` を設定。Supabase / Neon / Vercel Postgres など）

テーブルと管理者アカウントは初回アクセス時に自動作成されます。

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
| `DATABASE_URL` | PostgreSQL接続文字列。設定するとPostgreSQL、未設定ならSQLiteを使用 |
| `ADMIN_EMAIL` | 初期管理者のメールアドレス |
| `ADMIN_PASSWORD` | 初期管理者のパスワード |
| `SESSION_SECRET` | セッションCookieの署名キー（本番では必ず設定してください） |

## Vercelへのデプロイ手順

1. PostgreSQLデータベースを用意する（Supabase / Neon / Vercel Postgres のいずれか。無料枠で十分です）
2. Vercelでプロジェクトを作成し、**Root Directory を `payment-check` に設定**する
3. 環境変数を設定する
   - `DATABASE_URL` — 手順1の接続文字列（例: `postgresql://user:pass@host:5432/postgres?sslmode=require`。Supabaseの場合は「Connection string → Transaction pooler」のURLを推奨）
   - `SESSION_SECRET` — ランダムな文字列（例: `openssl rand -hex 32` で生成）
4. デプロイすると、初回アクセス時にテーブルと管理者アカウント（admin@toriyaro.com）が自動作成されます

`DATABASE_URL` 未設定のままVercelにデプロイするとSQLiteが使われ、サーバーレス環境ではデータが永続化されないので注意してください。
