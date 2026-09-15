# 入金確認システム

本部の入金確認担当者が、CSV取込・差額確認・店舗報告確認・レビュー・店舗/ユーザー管理を行うためのWebアプリです。

## 機能

- **ログイン / 初回パスワード変更** — メールアドレス+パスワード認証。初回ログイン（または管理者によるリセット後）はパスワード変更が完了するまで他画面を使えません（8文字以上・英字と数字を含む）
- **本部ダッシュボード** — CSV取込ステータス（MF/POSの最終取込）、差額あり（未確認）、CSV未取込（直近7日）、4日連続入金なし店舗、当月レビュー
- **月次照合（月次グリッド）** — 店舗×月の日別一覧（口座入金 / POS売上 / 差額 / データ元 / 店舗報告 / 確認状況）。行クリックで詳細シート（金額内訳・写真・店舗コメント・本部レビュー）を表示。差額0円の日は自動で確認済扱い。「全未確認を確認済にする」で月次一括確認
- **MoneyForward入金CSV取込** — ファイル選択 → プレビュー&マッピング → 結果 の3ステップ。カラムマッピング（取引日/入金額/店舗コード）、上書きモード、店舗マッピング状況（特定済み/未特定/重複スキップ/出金行スキップ/上書き対象）、未特定コードの店舗手動割当（`store_csv_codes` に学習され次回以降自動マッチ）
- **POS現金売上CSV取込** — 同様のウィザード（営業日/店舗コード/現金売上額/カード売上額）。未登録コードは取込対象から除外
- **CSV取込履歴** — MF/POSタブ、取込詳細（モード・件数・カラムマッピング）、取込取り消し（rollback: その取込で作成された行を削除。daily_reportsは影響なし）
- **マスタ管理 > 店舗** — 検索/エリア/状態フィルタ、店舗の追加・編集・有効化/無効化、MF/POS主コード + 副コード（1店舗Nコード）管理、CSV一括取込
- **マスタ管理 > ユーザー** — 検索/ロール/状態フィルタ、ユーザー追加（初期パスワード自動生成14桁 or 指定・一度だけ表示）、パスワードリセット、有効化/無効化、削除、CSV一括取込
- **店舗スタッフ画面** — 日次報告（手動入金額・現金売上・コメント・写真）を本部へ送信

## 技術構成

- Next.js 14（App Router）+ TypeScript + Tailwind CSS
- データベース（環境変数で自動切り替え）
  - ローカル開発: SQLite（better-sqlite3、`data/payment-check.db` に自動作成）
  - 本番/Vercel: PostgreSQL（`DATABASE_URL` を設定。Supabase / Neon / Vercel Postgres など）

テーブルとデモデータ（店舗・ユーザー・2026年4月の照合データ）は初回アクセス時に自動作成されます。

## セットアップ

```bash
cd payment-check
npm install
npm run dev
```

http://localhost:3000 を開くとログイン画面が表示されます。

## アカウント

初回起動時に以下が自動作成されます。

| ユーザー | メールアドレス | パスワード | ロール |
| --- | --- | --- | --- |
| 管理者 | admin@toriyaro.com | toriyaro@1234 | hq（本部） |
| デモ本部担当者 | hq@example.test | demo1234 | hq（本部） |
| デモ店舗スタッフ | store-st001@example.test | demo1234 | store_staff |
| 初回変更デモスタッフ | first-login@example.test | demo1234 | store_staff（初回パスワード変更のデモ用） |

環境変数 `ADMIN_EMAIL` / `ADMIN_PASSWORD` を設定して初回起動すると、管理者がそのアカウントで作成されます。

## CSV取込のサンプル

`samples/` にマニュアルのデモと同じ内容のCSVがあります。

- `samples/mf_demo_2026-04.csv` — MoneyForward入金CSV（未特定コード `MF-UNKNOWN`、出金行 `¥0`、店舗コード直接マッチ `ST003` を含む）
- `samples/pos_demo_2026-04.csv` — POS現金売上CSV

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
4. デプロイすると、初回アクセス時にテーブルとアカウントが自動作成されます

`DATABASE_URL` 未設定のままVercelにデプロイするとSQLiteが使われ、サーバーレス環境ではデータが永続化されないので注意してください。

### 表示速度について

- `vercel.json` でサーバー（Functions）のリージョンを東京（`hnd1`）に指定しています。データベースも東京リージョン（Supabaseなら Northeast Asia (Tokyo)）に作ると、DBとの往復が最短になります。米国リージョンのDBと組み合わせると1画面あたり数百ms〜数秒遅くなります
- Supabaseの接続文字列は「Transaction pooler」（ポート6543）を使ってください。直接接続（5432）はサーバーレスと相性が悪く、接続の確立に時間がかかります
- 無料プランのVercelは一定時間アクセスがないとサーバーが停止し、次のアクセス時に起動（コールドスタート）で1〜3秒かかります。これはプラットフォーム側の仕様です

## 注意事項

- CSVの文字コードはUTF-8 / Shift-JISを自動判定します
- rollback（取込取り消し）はその取込で作成された行を削除する操作で、overwrite前のデータは自動復元されません
