# 鶏ヤロー・まる助 衛生管理

毎日のクリーンを、写真でかんたん。

鶏ヤロー全店舗の衛生管理写真報告を管理する Web アプリ。
店舗スタッフが毎日 7 枚（デイリー）／週 1 回 7 枚（ウィークリー）の写真をスマホで撮影し、
管理者が 51 店舗の提出状況を一覧で確認できます。

## 技術スタック

- Vite + React 18 + TypeScript
- Tailwind CSS v3
- Firebase (Realtime Database + Storage)

## セットアップ

```bash
cd eisei-app
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

`dist/` を Netlify / Firebase Hosting にデプロイしてください。

## 初回利用手順

1. 管理者でログイン（パスワード: `admin2024`）
2. 「店舗管理」タブを開く
3. 「🔥 Firebase に 50 店舗を一括登録」ボタンをクリック
4. 各店舗にログイン URL とパスワード（既定: `Toriyaro1`）を配布

## 同時アクセス

100 名以上の同時利用にも対応するため、写真は Firebase Storage に
直接アップロードし、Realtime Database には URL のみを書き込みます。
管理ダッシュボードの一覧読み込みは `Promise.all` で並列化されています。

## ロゴ

`public/logo.svg` を差し替えると favicon・アプリ内ヘッダー・ログイン画面の
ロゴすべてに反映されます。公式の鶏ヤロー丸ロゴ PNG がある場合は
`public/logo.png` として配置し、`index.html`・`AppHeader.tsx`・
`LoginScreen.tsx` の参照を `/logo.png` に変更してください。
