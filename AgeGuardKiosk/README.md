# AgeGuard Kiosk (エイジー)

Android タブレット向け年齢推定キオスクアプリ。顔を枠に合わせると推定年齢が大きく表示されるだけのシンプルなスタッフ補助ツール。

> ⚠️ 本アプリは年齢確認の補助ツールであり、年齢確認の代替ではありません。最終判断は必ずスタッフが行ってください。

## 特長

- **完全オンデバイス処理**: カメラ映像・画像は一切外部送信しない
- **個人情報不保存**: 顔画像・推定年齢のログは残さない
- 顔検出: ML Kit Face Detection（オンデバイス）
- 年齢推定: TensorFlow Lite（カスタムモデル）
- UI: Jetpack Compose、横向き固定、常時点灯

## 動作要件

- Android 8.0 (API 26) 以上
- カメラ搭載（フロントカメラ推奨）
- 横向き対応タブレット

## ビルド・実行

1. Android Studio Iguana 以降で `AgeGuardKiosk/` を開く（または `./gradlew assembleDebug`）
2. `app/src/main/assets/age_model.tflite` を配置（後述）
3. 実機 / エミュレータにインストール

```bash
cd AgeGuardKiosk
./gradlew :app:installDebug
```

> モデル未配置の場合は **モックモード** で起動し、ランダムな年齢値（15〜65）を表示します。クラッシュしません。

## モデルの取得・配置

`MODEL_SETUP.md` を参照してください。

## ディレクトリ構成

```
AgeGuardKiosk/
├── app/src/main/
│   ├── java/com/toriguyaro/ageguard/
│   │   ├── MainActivity.kt
│   │   ├── ui/ (KioskScreen, FaceOverlay)
│   │   ├── camera/ (CameraManager, FaceAnalyzer)
│   │   ├── ml/ (AgeEstimator, AgeResult)
│   │   └── viewmodel/KioskViewModel.kt
│   ├── assets/age_model.tflite   ← 要配置
│   └── res/
└── build.gradle.kts
```

## 設計ポリシー

- 顔画像・推定年齢を**ファイル / ネットワークに出力しない**
- モデルなしでもクラッシュせず、モックモードで起動する
- 推論はバックグラウンドスレッド（Dispatchers.Default）で実行
- UIは合否判定・色分け・バナー・ログを一切持たない
