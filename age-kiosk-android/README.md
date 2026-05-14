# 年齢推定キオスク Android 版 (AgeKiosk)

Android タブレット (TPad / TECLAST 等) 向けの **完全オンデバイス** 年齢推定
キオスクアプリ。居酒屋入口に置いて、カメラに映った人の **推定年齢を
数字で表示** するシンプルなキオスクです。日本人向けに補正されています。

- 🇯🇵 日本人向けキャリブレーション (東アジア人バイアスの実測値補正)
- 🧠 ML Kit (顔検出) + TensorFlow Lite (年齢推定) でオンデバイス推論
- ⚡ NNAPI / GPU delegate でハードウェア加速 (TPad 程度の SoC でも実用速度)
- 📷 フロントカメラのライブ映像から自動推定 (送信ゼロ)
- 🖥 Lock Task Mode 対応の本格的キオスク化
- 🌙 CameraX のデフォルトで連続 AE/AF/WB、薄暗い入口でも動作

> iOS 版を Android (Kotlin + Jetpack Compose) に移植したものです。
> iOS 版は `../age-kiosk-ios/` を参照。

## アーキテクチャ

```
┌──────────────────┐   ImageProxy   ┌──────────────┐   FaceBox   ┌──────────────┐
│ CameraController ├───────────────▶│ FaceDetector ├────────────▶│ AgeEstimator │
└──────────────────┘  CameraX       │ (ML Kit)     │             │ (TFLite)     │
                                    └──────────────┘             └──────┬───────┘
                                                                        │ rawAge
                                                                        ▼
                                                           ┌────────────────────────┐
                                                           │ JapaneseCalibrator     │
                                                           │  + AgeSmoother (EMA)   │
                                                           └────────────┬───────────┘
                                                                        │ displayAge
                                                                        ▼
                                                                  KioskScreen (Compose)
```

## 日本人特化チューニング

公開モデル (IMDB-WIKI / Adience / UTKFace で学習) は欧米人サンプルが多く、
東アジア人を実年齢より **3〜6 歳若く** 推定する偏りが報告されています。

| 層 | 何をするか | 実装 |
|---|---|---|
| **1. モデル選定** | 東アジア人を多く含むデータで学習したモデルを使う | `tools/convert_age_model.py` |
| **2. 推論後補正** | 区分線形オフセット + 縮約 | `JapaneseCalibrator.calibrate` |
| **3. 時系列平滑化** | 顔向きで重み付けした指数移動平均 | `JapaneseCalibrator.kt::AgeSmoother` |

最高精度を出したい場合は AFAD など東アジア中心のデータで学習した
`age_net.tflite` に差し替え、`JapaneseCalibrator` のオフセットを 0 に
近づけてください。

## セットアップ

### 1. プロジェクトを Android Studio で開く

Android Studio **Hedgehog (2023.1)** 以降を推奨。

```sh
open age-kiosk-android   # macOS
# または Android Studio から "Open" → age-kiosk-android
```

要件:
- Android Studio Hedgehog+ / AGP 8.5+
- minSdk 26 (Android 8.0) / targetSdk 34
- TPad 系の格安端末でも問題なく動作する設定

### 2. 年齢推定モデルを追加

ライセンス上の理由でリポジトリには `.tflite` を同梱していません。

```sh
cd age-kiosk-android/tools
python -m venv .venv && source .venv/bin/activate
pip install torch torchvision onnx onnx-tf tensorflow numpy

python convert_age_model.py \
  --weights path/to/afad_or_dex_resnet50.pth \
  --output ../app/src/main/assets/age_net.tflite
```

`app/src/main/assets/age_net.tflite` に置くだけでアプリが自動ロードします。
入力 224x224 RGB、出力 [1] (回帰) または [1, N] (softmax) のどちらにも
対応しています。

### 3. ビルド & 実行

```sh
./gradlew installDebug
# あるいは Android Studio で Run ▶
```

## TPad に常駐させる (キオスク化)

Android の場合、選択肢は 3 段階あります。

### A. 画面の固定 (Screen Pinning) — 一番手軽

1. **設定 → セキュリティ → 画面の固定** を ON (端末によっては「アプリ固定」)
2. AgeKiosk を起動 → 最近のアプリ画面 → アプリのアイコンから「固定」
3. 解除は「戻る + 最近のアプリ」長押し (要 PIN 設定可能)

### B. ホームアプリに指定 — 起動時に自動で AgeKiosk

`AndroidManifest.xml` で既に `category.HOME` を宣言してあるため、

1. 一度ホームボタンを押す → アプリ選択ダイアログで AgeKiosk → 常時
2. 電源 ON で自動的に AgeKiosk が起動する

これだけで実用上「アプリから出にくい」状態になります。

### C. Device Owner + Lock Task Mode — 本気の業務用キオスク

複数台展開するなら最強。

1. ADB で Device Owner を設定 (初期化された端末で実行):
   ```sh
   adb shell dpm set-device-owner com.example.agekiosk/.AgeKioskDeviceAdmin
   ```
   ※ 本サンプルには簡易実装のみ。本格運用は MDM (Android Enterprise) 推奨。
2. Manifest の `android:lockTaskMode="if_whitelisted"` により、
   起動時に自動で `startLockTask()` がかかり、戻る・ホーム・通知も封じられる。

## 運用のコツ

- 端末を **電源接続で常時稼働** (`FLAG_KEEP_SCREEN_ON` で画面オン維持)
- 入口の客の目線に近い高さに固定 (壁面 / レジ脇)
- **逆光厳禁** — 客の背後に窓・ネオン看板を入れない
- 暗い入口は間接照明を 1 つ追加 (推奨 200 lx 以上)
- 長押しで強制リセット (運用デバッグ用)

## プライバシー

- 映像・推論結果は **端末メモリ内のみで処理**、ネットワーク送信ゼロ
- 静止画やログを **保存しません** (`allowBackup="false"` + ストレージ書き込みなし)
- `INTERNET` パーミッションを **要求していません**
- Manifest 内で `data_extraction_rules.xml` でクラウドバックアップも全除外

## ディレクトリ構成

```
age-kiosk-android/
├── build.gradle.kts
├── settings.gradle.kts
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── assets/
│       │   └── age_net.tflite      # ← 自分で配置
│       ├── java/com/example/agekiosk/
│       │   ├── AgeKioskApp.kt
│       │   ├── MainActivity.kt
│       │   ├── camera/
│       │   │   └── CameraController.kt
│       │   ├── vision/
│       │   │   ├── FaceDetector.kt
│       │   │   ├── AgeEstimator.kt
│       │   │   └── JapaneseCalibrator.kt
│       │   ├── model/
│       │   │   └── KioskViewModel.kt
│       │   └── ui/
│       │       ├── KioskScreen.kt
│       │       └── theme/Theme.kt
│       └── res/{values,values-ja,xml,…}
└── tools/
    └── convert_age_model.py        # PyTorch → TFLite 変換
```

## ライセンス

アプリコード本体は MIT。TFLite モデルは元データセット
(AFAD / UTKFace / IMDB-WIKI 等) のライセンスに従ってください。
特に商用利用では各データセットの規約確認が必須です。
