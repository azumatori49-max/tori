# 会社別環境（マルチテナント）の追加手順

アプリ本体（`rakuraku-check/index.html`）は全社共通の1つだけ。
会社ごとに `companies/<会社ID>/config.js` を置くと、デプロイ時に
**会社専用のURL**が自動で作られる：

```
https://azumatori49-max.github.io/tori/rakuraku-check/           ← 自社用（既定値で動作）
https://azumatori49-max.github.io/tori/rakuraku-check/c/demo/    ← companies/demo/
https://azumatori49-max.github.io/tori/rakuraku-check/c/xxx/     ← companies/xxx/
```

本体を修正すると**全社に一括で反映**される（各端末には自動アップデート通知が届く）。
config.js で差し替えられるのは：アプリ名／屋号リスト／テーマ色／接続先Firebase／テナントID。

## 新しい会社を追加するチェックリスト

1. **フォルダ作成** — `companies/demo/` をコピーして `companies/<会社ID>/` を作る（会社IDは英小文字。URLになる）
2. **Firebaseプロジェクト作成**（会社ごとに専用。データ完全分離のため）
   1. [Firebaseコンソール](https://console.firebase.google.com/)で新規プロジェクト作成 → ウェブアプリを追加し firebaseConfig を取得
   2. **Firestore Database** を作成（ロケーション: `asia-northeast1`、本番環境モード）
   3. **Authentication → 匿名** を有効化
   4. Firestore の**ルール**を本体 README の A案ルールに置き換えて公開
   5. AIを使う場合: **Firebase AI Logic** をセットアップ（Gemini Developer API）
   6. [Google Cloud 認証情報](https://console.cloud.google.com/apis/credentials)で API キーに **HTTPリファラー制限** `https://azumatori49-max.github.io/*` を設定
3. **config.js 記入** — appName / brands / accentColor / firebase を書き換える
4. **デプロイ** — ブランチに push すると自動でデプロイされる
5. **動作確認** — 会社URLを開き、①アプリ名と屋号が変わっている ②管理画面（`?admin=1`）の共通保存が「接続済み」 ③テストチェックを1件完了して別端末でも見える、を確認
6. **納品** — 会社URLを先方に伝え、ホーム画面への追加手順を案内

## 注意

- `firebase: null` のままの会社URLは**クラウド保存が無効**（端末内のみ）で動く。
  誤って自社データベースに接続することはない（本体側で防止済み）
- config.js は公開ファイルになるが、firebaseConfig はもともと公開情報なので問題ない
  （守りはFirestoreルール・匿名認証・APIキーのリファラー制限で行う）
- 会社を削除するときはフォルダを消してデプロイ（データはFirebase側に残る）
