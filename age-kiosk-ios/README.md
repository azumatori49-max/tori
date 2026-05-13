# 年齢推定キオスク (AgeKiosk)

iOS / iPadOS 向けの **完全オンデバイス** 年齢推定キオスクアプリ。
**居酒屋・バーの入店時年齢確認** を主用途に、日本人向けに
チューニングしたパイプラインで端末 1 台ですぐ設置できます。

- 🍶 居酒屋入店モード: 「入店OK / 要身分証確認」の **二択ゲート** 表示
- ⚖️ 境界域は必ず身分証確認に倒す **fail-closed** な保守的判定
- 🇯🇵 日本人向けキャリブレーション (東アジア人バイアスの実測値補正)
- 🧠 Apple Vision + Core ML (Neural Engine) で完全オンデバイス推論
- 📷 フロントカメラのライブ映像から自動推定 (送信ゼロ)
- 🌙 暗い入口向けの低照度カメラ設定 (Low-light Boost / 連続 AE/AF)
- 🖥 キオスクモード対応 (ガイド付きアクセス / シングルアプリモード)
- 🔐 スタッフ用 PIN 設定で閾値を現場調整 (1.5 秒長押しで起動)

## アーキテクチャ

```
┌──────────────┐   CVPixelBuffer   ┌──────────────┐   FaceBox   ┌──────────────┐
│ CameraManager├──────────────────▶│ FaceDetector ├────────────▶│ AgeEstimator │
└──────────────┘  AVFoundation     │ (Vision)     │             │ (Core ML)    │
                                   └──────────────┘             └──────┬───────┘
                                                                       │ rawAge
                                                                       ▼
                                                          ┌────────────────────────┐
                                                          │ JapaneseCalibrator     │
                                                          │  + AgeSmoother (EMA)   │
                                                          └────────────┬───────────┘
                                                                       │ displayAge
                                                                       ▼
                                                                 SwiftUI KioskView
```

## 日本人特化チューニング

公開されている年齢推定モデル (IMDB-WIKI / Adience / UTKFace で学習されたもの)
は、欧米人サンプルが圧倒的に多いため、東アジア人 — 特に日本人女性 — の
年齢を実年齢より **3〜6 歳若く** 推定する傾向が複数論文で報告されています
(NIST FRVT のレポートや、AFAD・MORPH 系研究を参照)。

本アプリでは次の三層で「日本人向けの実用値」へ寄せています。

| 層 | 何をするか | 実装 |
|---|---|---|
| **1. モデル選定** | 東アジア人を多く含むデータで学習したモデルを使う | `tools/convert_age_model.py` (DEX / AFAD / UTKFace-EastAsian) |
| **2. 推論後補正** | 区分線形オフセット + 縮約 (Bayesian shrink) | `Vision/JapaneseCalibrator.swift` |
| **3. 時系列平滑化** | 顔品質・角度で重み付けした指数移動平均 | `Vision/JapaneseCalibrator.swift::AgeSmoother` |

**最高精度を出したい場合**は AFAD など東アジア中心のデータで再学習した
モデルを `AgeKiosk/Resources/AgeNet.mlmodel` に置き換え、
オフセットを `JapaneseCalibrator.calibrate` で 0 に近づけてください。

## セットアップ

### 1. リポジトリを開く

```sh
open age-kiosk-ios/AgeKiosk.xcodeproj
```

要件: Xcode 15.4+ / iOS 16+。

### 2. 年齢推定モデルを追加

ライセンス上の理由でリポジトリには `.mlmodel` を同梱していません。
以下のいずれかで `AgeNet.mlmodel` を用意し、Xcode の
`AgeKiosk/Resources/` グループにドラッグして
**Target Membership = AgeKiosk** にチェックを入れてください。

#### A. 推奨: AFAD ベースの東アジア年齢モデル

```sh
cd age-kiosk-ios/tools
python -m venv .venv && source .venv/bin/activate
pip install torch torchvision coremltools
python convert_age_model.py \
  --weights path/to/afad_resnet50.pth \
  --output ../AgeKiosk/Resources/AgeNet.mlmodel
```

#### B. 最小構成: DEX (IMDB-WIKI) を変換 + 表示時補正で対応

同じスクリプトで DEX の重みを変換可能。日本人向けバイアスは
`JapaneseCalibrator` のオフセットで吸収します (デフォルト設定済み)。

### 3. ビルド & 実行

実機 (iPad 推奨) を接続して Cmd+R。初回起動時にカメラ許可を求めます。

## キオスクモードで運用する

iOS には専用 API がないため、以下のいずれかで「アプリから出られない」
設定にします。

### A. ガイド付きアクセス (個別端末・最も手軽)

1. **設定 → アクセシビリティ → ガイド付きアクセス** を ON
2. パスコードを設定
3. AgeKiosk を起動し、**サイドボタンを 3 回押す** で開始
4. 終了時も同じくサイドボタン 3 回 + パスコード

### B. シングル App モード (Apple Configurator / MDM)

複数端末を展開するなら以下が推奨:

1. Apple Configurator 2 で端末を「監視対象 (supervised)」にする
2. **App → シングル App モード** で `com.example.agekiosk` を指定
3. 端末は電源 ON で自動的に AgeKiosk のみが起動する状態になる

### 開発者向け補助

- アプリ側では `UIApplication.shared.isIdleTimerDisabled = true` で画面ロックを抑止
- 結果表示画面は 4 秒で自動的に「待機」に戻ります (`KioskViewModel.resultHoldDuration`)
- **3 本指タップ** で強制リセット (運用デバッグ用、本番では削除可)

## プライバシー

- 映像・推論結果は **端末メモリ内のみで処理** され、ネットワーク送信は一切行いません
- 静止画やログを **保存しません** (ストレージ書き込みなし)
- `Info.plist` の `NSCameraUsageDescription` で利用目的を明示しています
- 改正個人情報保護法・経産省「カメラ画像利活用ガイドブック」を前提に、
  店頭に **「映像は端末内処理のみで保存しません」** の掲示を推奨します

## ディレクトリ構成

```
age-kiosk-ios/
├── AgeKiosk.xcodeproj/
├── AgeKiosk/
│   ├── AgeKioskApp.swift           # @main, IdleTimer 無効化
│   ├── Camera/
│   │   └── CameraManager.swift     # AVCaptureSession ラッパ
│   ├── Vision/
│   │   ├── FaceDetector.swift      # VNDetectFaceCaptureQualityRequest
│   │   ├── AgeEstimator.swift      # Core ML 推論 (回帰/分類両対応)
│   │   └── JapaneseCalibrator.swift# 日本人向け補正 + EMA
│   ├── Models/
│   │   └── KioskViewModel.swift    # 状態機械
│   ├── Views/
│   │   ├── CameraPreviewView.swift # AVCaptureVideoPreviewLayer
│   │   └── KioskView.swift         # 画面全体
│   └── Resources/
│       ├── Info.plist
│       ├── Assets.xcassets/
│       └── AgeNet.mlmodel          # ← 自分で配置
└── tools/
    └── convert_age_model.py        # PyTorch → Core ML 変換
```

## 居酒屋入店モード (運用ガイド)

### 法的位置付け (重要)

- 日本では飲酒可能年齢は **満 20 歳以上** (未成年者飲酒禁止法 1 条)。
- 酒類提供を伴う店舗は、年齢が確認できない者に酒類を提供してはならない
  (同法 1 条 3 項)。違反は **50 万円以下の罰金** (同 3 条)。
- **顔写真からの年齢推定は「確認」には法的に代替できません。**
  本アプリは「明らかに 20 歳以上」と判断できる客をスムーズに通すための
  **一次スクリーニング** であり、境界域・疑義のある客には必ず
  運転免許証 / マイナンバーカード / パスポート 等の本人確認書類を
  スタッフが目視確認してください。
- 風適法・条例による 18 歳未満の入店制限がかかる業態 (深夜 0 時以降の
  酒類提供店、キャバクラ等) では、深夜営業プリセット (28 / 20 歳)
  への切替を推奨します。

### 既定の閾値 (スタッフ設定で変更可)

| 推定年齢 | 判定 | 画面表示 |
|---:|---|---|
| **25 歳以上** | 入店 OK (`allowAdult`) | ✅ どうぞ お入りください |
| 18-24 歳 | 要身分証確認 (`requireIdCheck`) | ⚠️ 身分証のご提示をお願いします |
| 18 歳未満 | 要身分証確認 (実質お断り) | ⚠️ 身分証のご提示をお願いします |

「23 歳に見えるが本当は 21 歳」のような若く見える成人を弾かないために、
**通すラインは余裕をもって 25 歳に設定** しています。境界域はすべて
スタッフによる目視確認に倒れます。

### 設置時のチェックリスト

- [ ] 入口の客の目線に近い高さに iPad を固定 (壁面 / レジ脇)
- [ ] 屋根のひさし下や暖簾の影で顔が暗くなりすぎていないか確認
  (推奨: 約 200 lx 以上、暗ければ間接照明を追加)
- [ ] **逆光厳禁** — 客の背後に窓・ネオン看板がないか
- [ ] ガイド付きアクセス / シングル App モードを有効化 (下記)
- [ ] 端末を電源接続 (24 時間稼働を想定)
- [ ] **店頭掲示** を準備 (次項)

### 店頭掲示の推奨文面

> **【年齢確認のお願い】**
> 当店では未成年者飲酒禁止法に基づき、入店時に年齢確認を実施しています。
> ご来店のお客様には、入口に設置のカメラで AI による年齢推定を行います。
>
> - 映像はこの端末内でのみ処理され、**保存・送信は一切行いません**。
> - 最終的な年齢確認はスタッフが本人確認書類で行います。
> - お手数ですが、運転免許証 / マイナンバーカード等のご提示にご協力ください。
>
> *改正個人情報保護法・経済産業省「カメラ画像利活用ガイドブック」に準拠*

### スタッフ操作

| 操作 | 機能 |
|---|---|
| 画面を **1.5 秒長押し** | スタッフ設定 (PIN: 初期 `0000`) |
| 画面を **3 本指タップ** | 強制リセット (待機状態へ) |

## ライセンス

アプリコード本体は MIT。Core ML モデルは元データセット
(AFAD / UTKFace / IMDB-WIKI など) のライセンスに従ってください。
特に商用利用では各データセットの規約確認が必須です。
