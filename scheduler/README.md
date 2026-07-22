# 日程調整アプリ(Calendly 風)

Google カレンダーと連動した日程調整アプリです。自分の空き時間を相手に選んでもらい、予約が入ると:

1. **Google カレンダーに Google Meet リンク付きの予定を自動作成**(ゲストも招待)
2. **ゲスト宛に面接リンク(Meet URL)付きの確認メールを Gmail から自動送信**

## 主な機能

- **Google ログイン** — OAuth で連携し、リフレッシュトークンを保存
- **予約ページ作成** — タイトル / 所要時間 / 受付曜日・時間帯 / 何日先まで受けるかを設定し、`/book/<slug>` の公開 URL を発行
- **空き時間の自動計算** — 設定した受付時間帯から、Google カレンダーの free/busy(既存の予定)を差し引いた枠だけを表示
- **二重予約防止** — 予約確定時にサーバー側で空き状況を再検証
- **予約管理** — ダッシュボードで予約一覧・Meet リンクを確認

## セットアップ

### 1. Google Cloud の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「API とサービス > ライブラリ」で以下を有効化:
   - **Google Calendar API**
   - **Gmail API**
3. 「OAuth 同意画面」を設定(テスト中は「テストユーザー」に自分の Gmail を追加)
4. 「認証情報 > OAuth 2.0 クライアント ID」を作成(種類: ウェブアプリケーション)
   - 承認済みリダイレクト URI に `http://localhost:3000/api/auth/callback` を追加
     (本番では `https://あなたのドメイン/api/auth/callback`)

### 2. 環境変数

```bash
cd scheduler
cp .env.example .env
# .env を編集して GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SESSION_SECRET を設定
```

### 3. 起動

```bash
pnpm install
pnpm dev
```

http://localhost:3000 を開き、「Google でログイン」から始めてください。

## 使い方

1. ログイン後、ダッシュボードで予約ページを作成(例: 「一次面接」30 分、平日 10:00〜18:00)
2. 発行された `https://.../book/interview-30min` のリンクを候補者にメールで送る
3. 候補者がリンクを開くと、あなたのカレンダーの空き枠だけが表示される
4. 候補者が枠を選んで予約すると:
   - あなたのカレンダーに Meet リンク付きの予定が入り、候補者にもカレンダー招待が届く
   - 候補者宛に「予約確定 + 面接リンク」のメールがあなたの Gmail から自動送信される

## 技術構成

- Next.js (App Router) + TypeScript
- SQLite (better-sqlite3) — `data/scheduler.db` に保存
- googleapis — Calendar API (freebusy / events.insert + Meet)、Gmail API (messages.send)
- セッションは HMAC 署名付き Cookie

## 制限事項・今後の拡張

- 予約ページの編集は未対応(削除して作り直し)
- 空き判定はメインカレンダー(primary)のみ対象
- キャンセル / リスケジュール機能は未実装
- タイムゾーンは主催者設定(デフォルト Asia/Tokyo)基準で表示
