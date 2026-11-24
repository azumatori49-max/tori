# 鶏ヤロー・まる助 衛生管理

店舗の毎日・毎週の衛生チェック写真を投稿し、本部がまとめて確認できる業務アプリ。

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

### 2. （初回のみ）新しい Hosting サイトを作成

旧アプリの Service Worker キャッシュ干渉を避けるため、サブドメイン
`eisei-tori` に独立した Hosting サイトを使います。

1. https://console.firebase.google.com/ → `toriyaro-eisei-faf2e` プロジェクト
2. 左メニュー → **Hosting**
3. ページ下部 **「別のサイトを追加」** をクリック
4. サイト ID に `eisei-tori` を入力 → 作成

### 3. ルールとアプリをデプロイ

```bash
cd toriyaro-eisei
npm run build
firebase deploy
```

完了後、URL は **`https://eisei-tori.web.app`** になります。
このURLを店舗スタッフ・管理者だけに配布してください。
（旧 `toriyaro-eisei-faf2e.web.app` は放置しても問題ありません）

### 4. 店舗の登録

新規店舗は管理者でログインし、「店舗管理」タブの「＋ 追加」（1店舗ずつ。「ランダム生成」でパスワードを作れる）か
「CSVで追加インポート」（`店舗名,パスワード` 形式）で登録する。
登録後はパスワードを画面で確認できないので、登録時に控えて各店舗に配布する。

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

## ロゴ・アイコン

- アプリ内ロゴ: `public/rakuraku.png`（`AppHeader.tsx` などが参照）
- ファビコン / ホーム画面アイコン: `public/favicon-32-v2.png` / `public/apple-touch-icon-180-v2.png`
  （`rakuraku.png` から切り出して縮小したもの。`index.html` が参照）

Hosting は png を1年キャッシュするため、アイコンを差し替えるときは同じ名前で上書きせず、
新しいファイル名にして `index.html` の参照を変えること。
