/*
 * 会社別設定のテンプレート（デモ用）
 *
 * 新しい会社を追加するときは、この demo フォルダをコピーして
 * companies/<会社ID>/config.js を作り、下の値を書き換えるだけ。
 * デプロイすると https://…/rakuraku-check/c/<会社ID>/ で公開される。
 * 詳しい手順は companies/README.md を参照。
 */
window.COMPANY_CONFIG = {
  // アプリ名（ホーム画面・報告書・ブラウザのタブに表示される）
  appName: "らくらく臨店チェック（デモ）",

  // 屋号（ブランド）の選択肢。この会社のブランド名に書き換える
  brands: ["デモ焼肉", "デモ居酒屋"],

  // テーマカラー（省略可。省略時はティール色）
  accentColor: "#3B6FB5",

  // 会社・テナント識別子（通常は "default" のままでよい。専用Firebaseを使うため）
  tenantId: "default",

  // この会社専用の Firebase プロジェクトの firebaseConfig をここに貼る。
  // null のままの間はクラウド保存が無効で、端末内保存のみで動作する（デモに便利）。
  firebase: null,
  // 例:
  // firebase: {
  //   apiKey: "AIza...",
  //   authDomain: "xxxx.firebaseapp.com",
  //   projectId: "xxxx",
  //   storageBucket: "xxxx.firebasestorage.app",
  //   messagingSenderId: "0000000000",
  //   appId: "1:0000000000:web:xxxxxxxx",
  // },

  // AIモデル（省略可。省略時は gemini-3.1-flash-lite）
  // aiModel: "gemini-3.1-flash-lite",
};
