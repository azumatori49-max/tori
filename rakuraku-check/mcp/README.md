# MCPサーバー（ClaudeやChatGPTから臨店データを参照する）

`worker.js` は、らくらく臨店チェックのデータを **MCP（Model Context Protocol）** で公開する
小さなサーバーです。Cloudflare Workers（無料枠で十分）に置くと、ClaudeやChatGPTの
チャットから「今月の要臨店は？」「柏店の面談内容は？」のように直接データを引けます。

- **読み取り専用**（書き込み・削除は一切できない）
- 写真は含まない（点数・面談テキストのみ）
- 提供ツール：`get_summary`（現況サマリー）／`get_ranking`（月別ランキング）／
  `list_checks`／`get_check_detail`／`get_interviews`／`get_csv`

## セットアップ（合計15分くらい・一度だけ）

### ① サーバー用のAPIキーを作る（Google Cloud）

既存のキーはウェブサイト限定（リファラー制限）なので、サーバー用に別のキーを作ります。

1. https://console.cloud.google.com/apis/credentials?project=rakuraku-check を開く
2. 「＋認証情報を作成」→「APIキー」→ 作成されたキーの編集画面を開く
3. 名前：`mcp-server-key` などに変更
4. **アプリケーションの制限：なし** のまま
5. **APIの制限：キーを制限** にして、次の2つだけにチェック：
   - Identity Toolkit API
   - Cloud Firestore API
6. 保存して、キーの文字列（AIza…）を控える

### ② 合言葉（SECRET）を決める

URLの一部になる長いランダム文字列です。例：`IbR9PJj39nbmJmbdCfB6-70cifo8OWKe`
（パスワード生成アプリなどで30文字以上のものを作ってください。**この例をそのまま使わない**）

### ③ Cloudflare Workers にデプロイ

1. https://dash.cloudflare.com/ → 左メニュー「**Workers & Pages**」→「**作成**」→「**Workerの作成**」
2. 名前を `rakuraku-mcp` などにして「デプロイ」→「**コードを編集**」
3. エディタの中身を全部消して、`worker.js` の内容を貼り付ける
4. 先頭付近の2ヶ所を書き換える：
   - `SECRET = "PASTE_LONG_RANDOM_SECRET_HERE"` → ②で決めた文字列
   - `SERVER_API_KEY = "PASTE_SERVER_API_KEY_HERE"` → ①で作ったキー
5. 「デプロイ」を押す。`https://rakuraku-mcp.＜あなたのID＞.workers.dev` というURLができる

接続URLは：`https://rakuraku-mcp.＜あなたのID＞.workers.dev/mcp/＜SECRET＞`

### ④ Claude / ChatGPT につなぐ

**Claude（おすすめ・有料プラン）**
1. claude.ai → 設定 → **コネクタ** → 「カスタムコネクタを追加」
2. 名前：`らくらく臨店チェック`、URL：③の接続URL → 追加
3. チャットで「今月の要臨店は？」と聞くと、Claudeがツールを呼んでデータで答える

**ChatGPT（対応プランのみ）**
設定 → コネクタ（開発者モード）→ MCPサーバーを追加 → 同じURLを登録

## セキュリティの注意

- **接続URLが鍵そのもの**です。社外の人に教えない・SNSに貼らない
- 万一漏れたら：Workerのコードを開いて `SECRET` を新しい文字列に変えて再デプロイ（旧URLは即無効）
- このリポジトリの `worker.js` には鍵を書き込まない（プレースホルダーのままにする）。
  実際の値は**Cloudflareの画面上でだけ**書き換える

## 動作確認

デプロイ後、ターミナルが使えるなら：

```
curl -s https://…workers.dev/mcp/＜SECRET＞ -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

ツール一覧のJSONが返れば成功。Claudeのコネクタ追加画面でも接続チェックが走ります。

## 項目を追加・変更したとき

アプリのチェック項目を追加・改名したら、`worker.js` 冒頭の `ITEM_NAMES` にも同じ変更を
入れて再デプロイしてください（忘れても壊れはせず、新項目が名前なしになるだけ）。
