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

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy --only hosting
```

## 実装上のポイント

- **カメラ起動**: `<input type="file" accept="image/*" capture="camera" />` を使用してスマホで直接カメラを起動。
- **画像圧縮**: アップロード前に canvas で最大 1200px / JPEG 80% に圧縮（`src/lib/imageUtils.ts`）。
- **管理者ダッシュボード**: 全店舗分の提出データを `Promise.all` で並列取得。
- **日付キー**: デイリーは `YYYY-MM-DD`、ウィークリーは `WYYYY-MM-DD`（月曜日の日付）。

## セキュリティルール（参考）

`docs/firebase-rules/` 配下に Realtime Database / Storage のルール例があります。
本番では Firebase Auth と組み合わせてさらに強化してください。
