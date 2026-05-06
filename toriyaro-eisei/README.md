# 鶏ヤロー 衛生管理 (toriyaro-eisei)

鶏ヤロー全51店舗の衛生管理写真報告システム。
店舗スタッフがスマホで毎日7枚（デイリー）・週1回7枚（ウィークリー）の写真を撮影して提出し、管理者が全店舗の提出状況を一覧確認できる Web アプリです。

## 技術スタック

- **フレームワーク**: Vite + React 18 + TypeScript
- **スタイリング**: Tailwind CSS v3
- **バックエンド**: Firebase (Realtime Database + Storage)
- **フォント**: Noto Sans JP / Syne / DM Mono

## 開発

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
npm run preview
```

## 初期セットアップ

1. `npm run build && npm run preview`（または Netlify / Firebase Hosting にデプロイ）
2. 管理者でログイン（パスワード: `admin2024`）
3. 「店舗管理」タブ →「🔥 Firebaseに51店舗を一括登録」
4. 各店舗にログインURLとパスワード（`Toriyaro1`）を配布

## ディレクトリ

```
src/
├── lib/           firebase.ts / dateUtils.ts / imageUtils.ts
├── data/          stores.ts (51店舗の初期データ)
├── types/         共通型
├── hooks/         useAuth / useStores / useSubmissions
└── components/
    ├── layout/    AppHeader / AdminNav
    ├── login/     LoginScreen
    ├── store/     StoreTopScreen / ReportCard / UploadScreen
    ├── admin/     AdminScreen / DashboardTab / StoreManageTab / StoreRow / StoreDetailModal
    └── ui/        PhotoSlot / StatusChip / SuccessOverlay / Lightbox
```

## Firebase データ構造

```
/stores/{storeKey}                 -> { name, password }
/submissions/{storeKey}/daily/{YYYY-MM-DD}    -> { count, submittedAt, photos[], storeName }
/submissions/{storeKey}/weekly/{WYYYY-MM-DD}  -> 同上
```

`weekKey` の `WYYYY-MM-DD` 部分はその週の月曜日の日付です（店舗側・管理者側で同じ `getWeekKey` を使用）。

## デプロイ

### Netlify
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Firebase Hosting（推奨）

リポジトリに `firebase.json` / `.firebaserc` を同梱済み。プロジェクトIDは
`toriyaro-eisei-faf2e` で固定されているため `firebase init` 不要。

```bash
# 初回のみ
npm install -g firebase-tools
firebase login

# 毎回のデプロイ
npm run build
firebase deploy --only hosting

# DB / Storage ルールも一緒にデプロイ
firebase deploy --only hosting,database,storage

# 本番に上げる前に一時URLでプレビュー
firebase hosting:channel:deploy preview
```

公開URL: `https://toriyaro-eisei-faf2e.web.app`

## 実装上のポイント

- **カメラ起動**: `<input type="file" accept="image/*" capture="camera" />` を使用してスマホで直接カメラを起動。
- **画像圧縮**: アップロード前に canvas で最大 1200px / JPEG 80% に圧縮（`src/lib/imageUtils.ts`）。
- **管理者ダッシュボード**: 全店舗分の提出データを `Promise.all` で並列取得。
- **日付キー**: デイリーは `YYYY-MM-DD`、ウィークリーは `WYYYY-MM-DD`（月曜日の日付）。

## 認証 (Firebase Anonymous Auth)

このアプリは、Firebase Realtime Database / Storage への読み書きをすべて
**匿名認証経由** で行います。アプリ起動時に自動で `signInAnonymously` が
呼ばれ、認証完了を待ってから DB / Storage アクセスが始まります。

ユーザー側の操作は不要ですが、Firebase Console で **匿名認証を有効化**
する必要があります（初回1回だけ）：

1. Firebase Console → **Authentication** → 「Sign-in method」タブ
2. 「**匿名**」プロバイダを **有効** に切り替え → 「保存」

これにより、URL を知っているだけの第三者からの読み書きが拒否されます。
（アプリ経由でアクセスした正規ユーザーは透過的に認証されるため UX には
影響しません。）

## セキュリティルール

`docs/firebase-rules/` 配下に Realtime Database / Storage のルールを置いています。

- `database.rules.json`: スキーマ検証付き。`stores`/`submissions` の各フィールドの型・長さ・必須項目をチェック。`count <= 14`、写真URLは `https://` 始まりに限定など。
- `storage.rules`: 全許可（最低限）。本番では Firebase Auth と組み合わせて強化を推奨。

Firebase Console で `database.rules.json` を貼り付けるか、`firebase deploy --only database` でデプロイしてください。

## 写真の自動削除（90日）

Storage 上にアップロードされた写真は **90日経過で自動削除** されるよう
設定します（HACCP の標準的な保存期間と Storage コストのバランス）。

設定方法は2通り。どちらかを **1度だけ** 実行すれば、以降は毎日自動で
古い写真が削除されます。

### A. gsutil コマンド（推奨）

```bash
gsutil lifecycle set docs/firebase-rules/storage-lifecycle.json \
  gs://toriyaro-eisei-faf2e.firebasestorage.app
```

設定確認:
```bash
gsutil lifecycle get gs://toriyaro-eisei-faf2e.firebasestorage.app
```

`gsutil` は Google Cloud SDK に含まれます。未インストールなら
[公式手順](https://cloud.google.com/sdk/docs/install) を参照。

### B. Google Cloud Console（GUI）

1. https://console.cloud.google.com/storage/browser/toriyaro-eisei-faf2e.firebasestorage.app を開く
2. 「ライフサイクル」タブ → 「ルールを追加」
3. 条件: 「**作成からの経過日数: 90**」、プレフィックス: `photos/`
4. アクション: 「**オブジェクトを削除**」
5. 保存

### 注意

- 90日 < age のオブジェクトは毎日（Google 側で）バッチ処理で削除されます。
  サイズや本数によっては反映に最大24時間かかります。
- 削除されるのは **Storage の写真ファイル** だけです。Realtime Database
  内の提出メタデータ（store name / submitted at / count）は残りますが、
  90日より前の日付には管理画面の日付ナビが進めない仕様にしてあるので
  運用上は問題ありません。

## 本番運用時の注意

### Firebase プラン
**Blaze（従量課金）プラン必須** です。Spark（無料）プランでは Realtime Database の同時接続が **100まで** に制限されるため、店舗が同時にアクセスする場面で接続失敗が発生します。Blaze ならデフォルトで20万接続まで可能です。

### 容量試算（70店舗運用）

| 区分 | 計算 | 月間データ量 |
|---|---|---|
| デイリー | 70店 × 7枚 × 30日 | 約 3.7 GB |
| ウィークリー | 70店 × 7枚 × 4回 | 約 0.5 GB |
| 合計 | | **約 4.2 GB / 月** |

※ 1枚 250KB 想定（1200px JPEG 80%圧縮後）。Storage 月額コストは数十円程度です。

### スケーラビリティ対応（実装済み）

- **写真アップロードは3並列＋自動リトライ3回**: モバイル回線で1枚失敗してもリトライ。全部やり直しになりません（`src/hooks/useSubmissions.ts`）。
- **店舗一覧はワンショット取得＋localStorageキャッシュ**: 200端末同時アクセスでも余分な永続購読が走りません（`src/hooks/useStoresOnce.ts`）。管理画面で店舗を追加/削除するとキャッシュは自動無効化されます。
- **画像はクライアント側で圧縮**: アップロード前に1200px / JPEG 80% に圧縮（`src/lib/imageUtils.ts`）。
- **管理者ダッシュボードは並列フェッチ**: 全店舗の提出データを `Promise.all` で同時取得。
