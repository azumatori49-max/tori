# 年齢推定キオスク (AgeKiosk)

iOS / iPadOS 向けの **完全オンデバイス** 年齢推定キオスクアプリ。
居酒屋入口に置いて、カメラに映った人の **推定年齢を数字で表示** する
シンプルなキオスクです。日本人向けにチューニングしてあります。

- 🇯🇵 日本人向けキャリブレーション (東アジア人バイアスの実測値補正)
- 🧠 Apple Vision + Core ML (Neural Engine) で完全オンデバイス推論
- 📷 フロントカメラのライブ映像から自動推定 (送信ゼロ)
- 🌙 暗い入口向けの低照度カメラ設定 (Low-light Boost / 連続 AE/AF)
- 🖥 キオスクモード対応 (ガイド付きアクセス / シングルアプリモード)

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

## 居酒屋入口に置くとき

- 入口の客の目線に近い高さに iPad を固定 (壁面 / レジ脇)
- 暖簾やひさしの影で顔が暗くなりすぎていないか確認 (推奨 ~200 lx 以上)
- **逆光厳禁** — 客の背後に窓・ネオン看板を入れない
- ガイド付きアクセス / シングル App モードでアプリから出られないように
- 端末を電源接続 (常時稼働を想定)

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

## ディレクトリ構成

```
age-kiosk-ios/
├── AgeKiosk.xcodeproj/
├── AgeKiosk/
│   ├── AgeKioskApp.swift           # @main, IdleTimer 無効化
│   ├── Camera/
│   │   └── CameraManager.swift     # AVCaptureSession ラッパ (低照度設定)
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

## ライセンス

アプリコード本体は MIT。Core ML モデルは元データセット
(AFAD / UTKFace / IMDB-WIKI など) のライセンスに従ってください。
特に商用利用では各データセットの規約確認が必須です。
