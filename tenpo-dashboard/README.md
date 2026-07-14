# らくらく店舗ダッシュボード(tenpo-dashboard)

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
KPI 集計スプレッドシート ─(GAS が毎日自動 POST)→ /api/gas/kpi → Firestore → らくらく店舗ダッシュボード
本部管理画面(コメント・お知らせ)──────────────────────→ Firestore → らくらく店舗ダッシュボード
既存の衛生管理アプリ(toriyaro-eisei)─(Realtime Database を直接参照)→ らくらく店舗ダッシュボード
```

- **KPI点数・各順位・原価率・人件費率・QSC**: スプレッドシートの GAS が毎日 `POST /api/gas/kpi` に送信して反映されます(`gas/dashboard.gs` 参照)。
- **コメント・お知らせ**: 本部管理画面から直接投稿します。
- **衛生チェックの提出状況**: 既存の衛生管理アプリ(Firebase `toriyaro-eisei-faf2e`)の
  Realtime Database から**リアルタイムに自動取得**します(`lib/hygiene.ts`)。
  店舗のマッチングは店舗名で行うため、ダッシュボードの店舗名は衛生管理アプリの店舗名と
  合わせてください(ブランド名の接頭辞付きでも一致します)。
  取得できない店舗はスプレッドシートの「日次提出」「週次提出」列の値にフォールバックします。
  「衛生チェックを提出する」ボタンは既存アプリをそのまま開きます。

## Firestore のデータ構造

| コレクション | 内容 |
| --- | --- |
| `stores/{id}` | 店舗(code, name, brand, passwordHash, active)+ 最新値のキャッシュ(latestMetrics, hygiene) |
| `stores/{id}/metrics/{YYYY-MM-DD}` | 日次 KPI の履歴(順位推移グラフに使用) |
| `comments/{id}` | 本部からのコメント(storeId が null なら全店舗宛て) |
| `announcements/{id}` | お知らせ |

アプリはサーバー(Firebase Admin SDK)経由でのみ Firestore にアクセスします。
`firestore.rules` はクライアントからの直接アクセスをすべて拒否する内容なので、そのままデプロイしてください。

## セットアップ

### 1. ローカルで動かす(デモモード)

```bash
cd tenpo-dashboard
pnpm install
pnpm dev
```

Firebase 未設定の場合は自動的にデモデータで動作します。

- 店舗ログイン: 店舗コード `101`〜`106` / パスワード `demo`
- 本部ログイン: パスワード `admin`(`ADMIN_PASSWORD` 未設定時)

### 2. Firebase を用意する(本番)

1. [Firebase コンソール](https://console.firebase.google.com/)でプロジェクトを作成し、**Cloud Firestore** を有効化する(本番モード)
2. セキュリティルールに `firestore.rules` の内容を貼り付けて公開する
3. 店舗の登録は**デプロイ後にスプレッドシートのメニュー「⑤ 店舗をアプリに登録」で行えます**
   (「店舗マスタ」シートに店舗コード・店舗名・初期パスワードを入れて⑤を実行するだけ。
   ターミナルが使える場合は `scripts/seed-firestore.mjs` でも投入できます)
4. `.env.example` を参考に環境変数を設定する(ホスティング先にも同じ値を設定)

   | 変数 | 内容 |
   | --- | --- |
   | `FIREBASE_SERVICE_ACCOUNT` | サービスアカウント JSON(1 行で)。※下記の代替方法あり |
   | `AUTH_SECRET` | セッション Cookie 署名用のランダム文字列 |
   | `ADMIN_PASSWORD` | 本部管理画面のパスワード |
   | `GAS_SYNC_SECRET` | GAS 同期 API の共有シークレット |
   | `NEXT_PUBLIC_HYGIENE_APP_URL` | 既存の衛生管理アプリの URL |

   Firebase の認証は次のいずれでも可: ① `FIREBASE_SERVICE_ACCOUNT`(JSON まるごと)、
   ② `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`、
   ③ **Firebase App Hosting / Cloud Run 上なら設定不要**(自動認証)。

### 3. デプロイ(Firebase App Hosting 推奨)

Next.js アプリなので [Firebase App Hosting](https://firebase.google.com/docs/app-hosting) にそのままデプロイできます。

1. Firebase コンソールで App Hosting を有効化し、この GitHub リポジトリを接続する(ルートディレクトリに `tenpo-dashboard` を指定)
2. 環境変数(`AUTH_SECRET`, `ADMIN_PASSWORD`, `GAS_SYNC_SECRET`, `NEXT_PUBLIC_HYGIENE_APP_URL`)を App Hosting 側に設定する
   (App Hosting 上では Firebase の認証情報は自動で解決されます)
3. デプロイ後の URL を GAS スクリプトの `ENDPOINT` に設定する

### 4. スプレッドシート(GAS)を接続する

`gas/dashboard.gs` を 1 ファイル貼るだけで、シートの自動生成から同期まで行えます。

1. スプレッドシートの「拡張機能 > Apps Script」に `gas/dashboard.gs` を貼り付けて保存し、スプレッドシートを再読み込みする
2. メニュー「ダッシュボード連携 > ① 初期セットアップ」を実行
   → 「店舗マスタ」「KPI」「原価率」「人件費率」「QSCアンケート」「設定」「ダッシュボード連携」が自動生成される
   (旧「データ入力」シートがある場合は値を自動移行し、旧シートは「(旧・削除可)」にリネームされます)
3. 「設定」シートにデプロイ先のエンドポイント URL を入力し、「店舗マスタ」を実店舗に書き換える
4. メニュー「② API シークレットを設定」でアプリ側の `GAS_SYNC_SECRET` と同じ値を登録する
5. **指標ごとのシート(KPI / 原価率 / 人件費率 / QSCアンケート)の C 列に数値を入力する**
   (店舗コード・店舗名は店舗マスタから自動反映。衛生チェックは衛生管理アプリから自動取得のため入力不要)
6. メニュー「③ 今すぐ同期」で動作確認し、「④ 毎日の自動同期を設定」で毎日の自動送信を有効にする

**順位(KPI順位・原価率順位・人件費率順位・QSC順位・総合順位)と全店平均は、
同期のたびに GAS が自動計算します。**シートに入力するのは各店舗の生の数値だけです。

- 総合順位: 4 指標の順位の平均が小さい順(同率は KPI 点数の高い方が上位)
- QSC 前回順位: 前回同期時の QSC 順位を自動で引き継ぎ
- 計算結果は「ダッシュボード連携」シートに書き出されるので、送信内容を目で確認できます

## 技術構成

- Next.js 15(App Router)+ React 19 + TypeScript
- Firebase Cloud Firestore(Admin SDK、サーバー側のみ)。未設定時はデモデータで動作
- 認証: HMAC 署名付き Cookie セッション(店舗: 店舗コード+パスワード / 本部: 管理パスワード)
- グラフは依存ライブラリなしの SVG 実装(タップ・ホバーで日別順位を表示)
