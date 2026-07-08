# 導入セットアップガイド（本番環境）

らくらく店舗カンリを顧客環境に導入する手順です。1顧客 = 1 Firebase プロジェクトの構成を推奨します（データ・料金・障害の分離のため）。

## 1. Firebase プロジェクト作成

1. [Firebase コンソール](https://console.firebase.google.com/) で「プロジェクトを追加」
2. 以下のサービスを有効化する
   - **Authentication** → ログイン方法 → **匿名** を有効化
   - **Realtime Database** → データベースを作成（ロケーションは `asia-southeast1` 推奨）
   - **Storage** → 開始する
   - **Hosting** → 開始する

## 2. Webアプリの登録と接続情報

1. プロジェクトの設定 → 全般 → 「アプリを追加」→ Web
2. 表示された構成情報を `.env` に記入する

```bash
cp .env.example .env
# VITE_FIREBASE_API_KEY などを記入
```

## 3. セキュリティルールのデプロイ

```bash
npm i -g firebase-tools
firebase login
firebase use <プロジェクトID>
firebase deploy --only database,storage
```

同梱の `database.rules.json` / `storage.rules` は「匿名認証済みユーザーのみ読み書き可」という構成です。

## 4. ビルドとデプロイ

```bash
pnpm install
pnpm build
firebase deploy --only hosting
```

デプロイ後、表示されたURL（`https://<プロジェクトID>.web.app`）にアクセスして動作確認します。

## 5. 初期設定（管理者作業）

1. 管理者パスワード `admin1234`（初期値）でログイン
2. **設定 → 管理者パスワード** を必ず変更する
3. **店舗管理** から実際の店舗を登録（デモ店舗は Firebase 未設定時のみ表示されます）
4. **設定 → チェック項目** を顧客の運用に合わせて編集
5. 各店舗に「URL・店舗名・店舗パスワード」を配布。スマホのブラウザで開き「ホーム画面に追加」してもらう

## 6. 運用のポイント

- **古いデータの整理**: 設定画面から手動実行（90日より前を削除）。定期自動化したい場合は Cloud Functions のスケジュール実行で `cleanupOldData` 相当の処理を追加してください
- **業務日の切り替え時刻**（初期値 朝9時）や履歴日数は `src/branding.ts` で変更してビルドし直します
- **アプリの更新**: `pnpm build && firebase deploy --only hosting` するだけで、利用中の端末には「新バージョンあり」の通知が表示されます

## 料金の目安

Firebase 無料枠（Spark）でも小規模なら動作しますが、写真を扱うため **Blaze（従量課金）** を推奨します。50店舗 × 毎日10枚 × 200KB ≒ 月3GB 程度のアップロードで、Storage/転送費用は月数百円〜千円程度が目安です（90日で自動整理する前提）。
