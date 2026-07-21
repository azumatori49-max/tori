# セットアップ手順

## 1. 事前に用意するもの

| もの | 用途 |
|---|---|
| Google アカウント（社内） | GAS / スプレッドシート / Drive |
| Firebase プロジェクト | Realtime Database（スタッフアワードの構成を流用可） |
| Anthropic API キー | 文面生成 |
| Google Cloud プロジェクト | Text-to-Speech API の有効化と API キー |
| LINE Messaging API チャネル | タスク配信・承認・通知 |
| 中古ミニPC + モニター | 店内表示（Chrome kiosk） |

## 2. GAS のデプロイ

```bash
npm i -g @google/clasp
clasp login
cd ai-tencho/gas
cp .clasp.json.example .clasp.json   # scriptId を記入
clasp push
```

1. スプレッドシートを新規作成し、IDを控える
2. GAS エディタでスクリプトプロパティを設定（下表）
3. `setupSheets()` を手動実行 → シート一式と初期係数が入る
4. `setupTriggers()` を手動実行 → 5分毎 mainTick / 15分毎 monitorHeartbeat / 週次 checkRuleDemotion
5. 「ウェブアプリとしてデプロイ」（全員がアクセス可）→ URL を LINE チャネルの Webhook に設定
6. `pregenerateFixedPhrases()` を手動実行 → 固定文言のMP3を事前生成

### スクリプトプロパティ一覧

| キー | 必須 | 内容 |
|---|---|---|
| `SPREADSHEET_ID` | ● | データストアのスプレッドシート |
| `ANTHROPIC_API_KEY` | ● | Claude API キー |
| `CLAUDE_MODEL` | | 既定 `claude-sonnet-5` |
| `FIREBASE_DB_URL` | ● | `https://xxx-default-rtdb.firebaseio.com` |
| `FIREBASE_DB_SECRET` | ● | RTDB のデータベースシークレット |
| `TTS_API_KEY` | ● | Cloud Text-to-Speech の API キー |
| `TTS_VOICE` / `TTS_RATE` | | 既定 `ja-JP-Neural2-B` / `1.0`（声の選定は OPEN_QUESTIONS #8） |
| `DRIVE_AUDIO_FOLDER_ID` | ● | MP3 キャッシュ用 Drive フォルダ |
| `LINE_CHANNEL_ACCESS_TOKEN` | ● | Messaging API のトークン |
| `LINE_ADMIN_USER_ID` | ● | 東さんの userId（承認・監視通知） |
| `LINE_MANAGER_USER_ID` | ● | 店長の userId（乖離通知・タスク承認） |
| `LINE_STAFF_GROUP_ID` | ● | スタッフグループの groupId（承認済みタスクのみ） |
| `ADMIN_EMAIL` | 推奨 | LINE 不通時の通知フォールバック |
| `PLAN_DAILY_SALES` | ● | 事業計画の日商（円）。**実績から動かさない** |
| `PLAN_AVG_CHECK` | | 計画客単価。既定 3000 |
| `PHASE` | | 運用フェーズ。既定 1 |
| `APPROVAL_MODE` | | 既定 true（最初の2週間は必ず true のまま） |
| `JMA_AREA_CODE` | | 気象庁エリアコード。既定 130000（東京）。新店所在地に合わせる |
| `FIXED_COST_DAILY` / `HOURLY_WAGE` | | 粗利推定用。固定費日割り／平均時給 |

## 3. Firebase

1. Realtime Database を作成（東京リージョン）
2. セキュリティルール：読み取りは `store` 配下のみ公開、書き込みは全て拒否（書き込みはGASのシークレット経由のみ）

```json
{
  "rules": {
    "store": { ".read": true, ".write": false },
    ".read": false,
    ".write": false
  }
}
```

## 4. 店内モニター（Chrome kiosk）

1. `display/config.example.js` を `config.js` にコピーして Firebase の設定を記入
2. `display/` を任意の静的ホスティング（Firebase Hosting 推奨）に配置
3. ミニPC側の設定：
   - BIOS で「AC電源復旧時に自動起動」を有効化（停電後の無人復帰）
   - スタートアップに以下のショートカットを登録

```
chrome.exe --kiosk --autoplay-policy=no-user-gesture-required ^
  --disable-session-crashed-bubble --noerrdialogs https://<配置先URL>/
```

4. **音声出力はバックヤードのスピーカー／インカム系統にのみ接続する（§7）。ホールのBGM系統に繋がないこと**
5. Windows Update の自動再起動時間を営業時間外（例: 朝5時）に設定

## 5. LINE

1. Messaging API チャネルを作成し、応答メッセージをオフ、Webhook をオン
2. Webhook URL に GAS の WebApp URL を設定
3. 東さん・店長がボットを友だち追加し、スタッフグループにボットを招待
4. 各 userId / groupId はイベントログ（`log` シートか GAS の実行ログ）から取得してプロパティに設定

## 6. 外部からの死活監視（推奨）

GAS 自体が死ぬと内蔵の監視も一緒に死ぬため、無料の外形監視を1本張っておく：

- UptimeRobot 等で GAS WebApp URL（GET）を60分間隔で監視
- あるいは display の配置先 URL を監視（ホスティング死活のみ）

## 7. 開店前チェックリスト

- [ ] 既存店（松戸店など）で2ヶ月の試運転を開始した（§11「新店1本勝負にしない」）
- [ ] `APPROVAL_MODE=true` のまま2週間、承認フローで文面を確認した
- [ ] キルスイッチ（スプレッドシート `config!B1` に STOP）を店長が実際に操作して止まることを確認した
- [ ] 日報を1日3分以内で入力できることを店長本人が確認した
- [ ] 欠測日（わざと未入力）に朝礼が定型文へ劣化することを確認した
- [ ] スピーカーがホールに聞こえない音量・配線であることを営業時間に確認した
- [ ] `feedback` シートに発報と完了が記録されている（開店初日から溜める）
