# 店長ダッシュボード(tenpo-dashboard)

店長が PC を使わず、店舗の iPad やスマートフォンだけで日々の数値を確認できるダッシュボードです。
管理(コメント・お知らせの配信)は本部が PC の管理画面から行います。

## 画面構成

| URL | 対象 | 内容 |
| --- | --- | --- |
| `/login` | 店舗 | 店舗コード + パスワードでログイン |
| `/` | 店舗(iPad・スマホ) | KPI点数・総合順位・原価率・人件費率・QSCアンケート、衛生チェックの提出状況、順位推移グラフ、コメント、お知らせ |
| `/announcements` | 店舗 | お知らせ一覧 |
| `/admin/login` | 本部 | 管理パスワードでログイン |
| `/admin` | 本部(PC) | 全店舗の KPI・衛生チェック提出状況の一覧 |
| `/admin/comments` | 本部(PC) | 店舗宛てコメントの投稿・削除 |
| `/admin/announcements` | 本部(PC) | お知らせの配信・削除 |
| `POST /api/gas/kpi` | GAS | スプレッドシートからの KPI 同期 API |

## データの流れ

```
KPI 集計スプレッドシート ─(GAS が毎日自動 POST)→ /api/gas/kpi → Supabase → 店舗ダッシュボード
本部管理画面(コメント・お知らせ)──────────────────────→ Supabase → 店舗ダッシュボード
既存の衛生管理アプリ ─(リンクでそのまま利用)─ 提出状況はスプレッドシート経由で同期
```

- **KPI点数・各順位・原価率・人件費率・QSC**: スプレッドシートの GAS が毎日 `POST /api/gas/kpi` に送信して反映されます(`gas/sync-kpi.gs` 参照)。
- **コメント・お知らせ**: 本部管理画面から直接投稿します。
- **衛生管理**: 既存アプリをそのまま使用します。`NEXT_PUBLIC_HYGIENE_APP_URL` を設定するとダッシュボードから「衛生チェックを提出する」ボタンで開けます。提出枚数はスプレッドシートの「日次提出」「週次提出」列で同期できます。

## セットアップ

### 1. ローカルで動かす(デモモード)

```bash
cd tenpo-dashboard
pnpm install
pnpm dev
```

Supabase 未設定の場合は自動的にデモデータで動作します。

- 店舗ログイン: 店舗コード `101`〜`106` / パスワード `demo`
- 本部ログイン: パスワード `admin`(`ADMIN_PASSWORD` 未設定時)

### 2. Supabase を用意する(本番)

1. Supabase プロジェクトを作成し、SQL Editor で `supabase/schema.sql` を実行する
2. 店舗のパスワードを設定する

   ```bash
   node scripts/hash-password.mjs <店舗のパスワード>
   # 出力された salt:hash を stores.password_hash に UPDATE する
   ```

3. `.env.example` を参考に環境変数を設定する(Vercel 等のホスティングにも同じ値を設定)

   | 変数 | 内容 |
   | --- | --- |
   | `SUPABASE_URL` | Supabase プロジェクト URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role キー(サーバーのみで使用) |
   | `AUTH_SECRET` | セッション Cookie 署名用のランダム文字列 |
   | `ADMIN_PASSWORD` | 本部管理画面のパスワード |
   | `GAS_SYNC_SECRET` | GAS 同期 API の共有シークレット |
   | `NEXT_PUBLIC_HYGIENE_APP_URL` | 既存の衛生管理アプリの URL |

### 3. スプレッドシート(GAS)を接続する

1. KPI 集計スプレッドシートに「ダッシュボード連携」シートを作成する(列の仕様は `gas/sync-kpi.gs` のコメント参照)
2. 「拡張機能 > Apps Script」に `gas/sync-kpi.gs` を貼り付け、`ENDPOINT` をデプロイ先 URL に変更する
3. スクリプトプロパティに `GAS_SYNC_SECRET` を設定する(手順 2 と同じ値)
4. `syncToDashboard` を手動実行して動作確認し、`setupDailyTrigger` を一度実行して毎日の自動同期を有効にする

## 技術構成

- Next.js 15(App Router)+ React 19 + TypeScript
- Supabase(Postgres)。未設定時はデモデータで動作
- 認証: HMAC 署名付き Cookie セッション(店舗: 店舗コード+パスワード / 本部: 管理パスワード)
- グラフは依存ライブラリなしの SVG 実装(タップ・ホバーで日別順位を表示)
