# 鶏ヤロー・まる助 衛生管理

毎日のクリーンを、写真でかんたん。

鶏ヤロー全店舗の衛生管理写真報告（デイリー7枚／ウィークリー7枚）を提出・確認するWebアプリ。

## Stack
Vite + React 18 + TypeScript / Tailwind CSS v3 / Firebase Realtime Database + Storage

## セットアップ
```bash
npm install
npm run dev
```

## ビルド
```bash
npm run build
```

## デプロイ（Netlify）
```bash
npx netlify deploy --prod --dir=dist
```
`netlify.toml` と `public/_redirects` でSPAルーティングが設定済み。

## 初回設定
1. 管理者でログイン（パスワード: `admin2024`）
2. 「店舗管理」タブを開く
3. 「🔥 Firebaseに50店舗を一括登録」をクリック
4. 各店舗にURLとパスワード（`Toriyaro1`）を配布

## ロゴ差し替え
`public/logo.svg` を公式PNGに差し替えて `index.html` の `/logo.svg` 参照を `/logo.png` に置換してください。アプリ内のロゴ参照は `AppHeader.tsx` / `LoginScreen.tsx` / `AdminScreen.tsx` にあります。
