# 鶏ヤロー・まる助 衛生管理

毎日のクリーンを、写真でかんたん。

鶏ヤロー全店舗の衛生管理写真報告を管理する Web アプリ。

## 技術スタック

- Vite + React 18 + TypeScript
- Tailwind CSS v3
- Firebase (Realtime Database + Storage + Hosting)

## ローカル開発

```bash
cd toriyaro-eisei
npm install
npm run dev   # http://localhost:5173
```

## Firebase Hosting にデプロイ（リンクを知っている人だけに公開）

### 1. Firebase CLI を準備（初回のみ）

```bash
npm install -g firebase-tools
firebase login                  # ブラウザでGoogleログイン
```

### 2. ルールとアプリをデプロイ

```bash
cd toriyaro-eisei
npm run build                   # dist/ を生成
firebase deploy                 # Hosting + Realtime DB ルール + Storage ルール
```

デプロイ後、`https://toriyaro-eisei-faf2e.web.app` のような URL が発行されます。
このURLを店舗スタッフ・管理者だけに配布してください。

### 3. 初回のみ：50店舗を一括登録

1. デプロイ済み URL を開く
2. 「＊ 管理者」を選択しパスワード `admin2024` でログイン
3. 「店舗管理」タブを開く
4. 「🔥 Firebaseに50店舗を一括登録」ボタンをクリック
5. 各店舗にURLとパスワード（既定: `Toriyaro1`）を配布

## 「リンク知っている人だけに」のセキュリティ設計

| 対策 | 状態 |
|---|---|
| ロボット検索除外 (`robots.txt`, `X-Robots-Tag`) | ✅ |
| パスワードを **PBKDF2-SHA256 (100k iterations + 店舗別ソルト)** でハッシュ化保存 | ✅ |
| Realtime DB の書き込みバリデーション（ストア名/ハッシュ長/写真件数等） | ✅ |
| Storage は `image/*` のみ・5MB上限・特定パスのみ書込可 | ✅ |
| HTTPS 強制（Firebase Hosting が自動） | ✅ |
| 各種セキュリティヘッダ（XCTO, XFO, Referrer-Policy） | ✅ |

### より高い保証が必要なら（将来の拡張）

- **Firebase Authentication 導入** — 匿名認証＋カスタムクレームで「ログインした storeKey の店舗だけが書き込み可」とすると、URL流出時の被害を完全に局所化できます。
- **Cloud Functions による認証** — Callable Function でパスワード検証→カスタムトークン発行。
- **Firebase App Check** — Bot/不正クライアントからの直接API呼び出しをブロック。

## Netlify にデプロイする場合

`netlify.toml` と `public/_redirects` も同梱しています。

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

## ロゴ差し替え

`public/logo.svg` がアプリ内ロゴ／ファビコンとして使われます。
公式の鶏ヤロー丸ロゴ PNG がある場合は `public/logo.png` として置き、
`index.html`・`AppHeader.tsx`・`LoginScreen.tsx` の参照を `/logo.png` に変えてください。
