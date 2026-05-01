# AgeEstimator

iOS の **CoreML 完全オンデバイス** 年齢推定アプリ。日本人の顔に合わせてキャリブ
レーションした age regression モデルを載せ、SK-II ミラー風の楕円フレームに顔を
合わせると推定年齢を表示します。

カメラ映像・顔画像・推定結果は端末外に一切送信しません(`NSCameraUsageDescription`
にも明記)。

## アーキテクチャ

```
AVCaptureSession  ──► CVPixelBuffer
        │
        ▼
  Vision: VNDetectFaceRectanglesRequest (Rev3)
        │      ─► boundingBox / yaw / roll / pitch
        ▼
  FrameAlignment (枠フィット判定)
        │
        ├─ 連続 12 フレーム整合 ─► アニメ進捗表示
        ▼
  CoreML: AgeNetJP.mlpackage  (MobileNetV3-Small / 100-way age softmax)
        │      ─► 期待値で年齢に丸める
        ▼
  JapaneseCalibration  (10 年代ごとのバイアス補正)
        │
        ▼
  PredictionSmoother (5 サンプルの trimmed mean)
        │
        ▼
  推定年齢を SwiftUI に表示
```

主要ファイル:

| ファイル | 役割 |
| --- | --- |
| `AgeEstimatorApp.swift` | SwiftUI エントリ |
| `Views/RootView.swift` | カメラ + 楕円ガイド + 年齢表示 |
| `Views/OvalFrameOverlay.swift` | SK-II 風の楕円フレーム描画 |
| `Camera/CameraManager.swift` | フロントカメラ AVCaptureSession |
| `Camera/FaceDetector.swift` | Vision で顔検出 + クロップ |
| `Camera/FrameAlignment.swift` | 枠との整合スコア |
| `ML/AgeEstimator.swift` | CoreML 推論ラッパー |
| `ML/JapaneseCalibration.swift` | 日本人向けバイアス補正 + smoother |
| `AgeEstimationViewModel.swift` | 状態機械 |

## ビルド

[XcodeGen](https://github.com/yonaskolb/XcodeGen) を使う想定です:

```bash
brew install xcodegen
cd AgeEstimator
xcodegen generate
open AgeEstimator.xcodeproj
```

実機(A12 以降推奨。Apple Neural Engine 利用)をターゲットに走らせてください。
シミュレーターでもカメラは動きませんが UI 確認はできます。

`Models/AgeNetJP.mlpackage` がバンドルに含まれていない場合、Debug ビルドは
ランダムなダミー年齢を返します。リリース時は必ずモデルを同梱してください。

## モデルの作り方

`Scripts/finetune_japanese.py` で AFAD / AAF / MegaAge-Asian の 3 つの東アジア
データセットを混ぜて MobileNetV3-Small を fine-tune し、`mlpackage` として書き
出します。出力は **画像入力(224x224 RGB)** → **100 次元の年齢分布** で、Swift
側は期待値を取って 1 つの年齢にまとめます。

```bash
cd Scripts
pip install torch torchvision coremltools pillow
python finetune_japanese.py \
    --afad /data/AFAD-Full \
    --aaf  /data/All-Age-Faces \
    --megaage /data/megaage_asian \
    --out  ../Models/AgeNetJP.mlpackage
```

学習後、`measure_calibration.py` で日本人 held-out セットの 10 年代ごとの誤差
を測り、`JapaneseCalibration.default.decadeOffsets` を更新してください。
これで「日本人特化チューニング」の最終 1mm を当てに行けます。

## 未成年フィルタ

`MinorGuard`(`ML/JapaneseCalibration.swift`)が、明らかな未成年と判定された
場合に推定年齢を**表示しません**(`AgeEstimationState.blockedMinor`)。

ロジック:

```
平滑化後の推定年齢 + safetyMargin × 標準偏差   <   displayThreshold
```

両辺を見ているのがポイントで、推定値が threshold をわずかに下回るだけでは
ブロックせず、**「上振れ余地を考えても閾値未満」と確信できたときだけ**ブロック
します。これによって閾値ギリギリの成人を弾く偽陽性を抑えています。既定値は

| パラメータ | 値 | 意味 |
| --- | --- | --- |
| `displayThreshold` | 20 | 表示を許す下限。年齢モデルの MAE が 3〜5 歳あるため 18 ではなく 20 から始めるのが安全 |
| `safetyMargin` | 1.5 | 上限見込みに掛ける標準偏差の倍率 |
| `minSamples` | 5 | この数のサンプルが揃うまでは判定を保留 |

`displayThreshold` は要件(18 / 20 / 21 など)に合わせて変更してください。
学習データセット側でも 18 歳未満を強めにオーバーサンプリングして判別性能を
上げることを推奨します(`finetune_japanese.py` の Dataset 実装で対応)。

## キャリブレーションの考え方

汎用モデル(IMDB-Wiki、UTKFace 等で学習)は東アジア顔に対して

* 10 代を実年齢より老けて見積もる
* 30 〜 50 代を実年齢より若く見積もる

傾向があります。`JapaneseCalibration` は 10 年代ごとの加算オフセットを線形
補正として後段に載せ、再学習なしでも 2〜3 歳ぶんの偏りを除去できる作りに
しています。再学習する場合は `decadeOffsets` を全部 `0.0` にしてください。

## ライセンス / 注意

* このリポジトリのコードは内部利用想定です。
* AFAD / AAF / MegaAge-Asian / IMDB-Wiki などの**学習データセットは独自の
  利用条件**があります。商用配布する場合は各データセットの規約を必ず確認
  してください。
* 推定は娯楽・接客 UX 用途を想定しており、医療・採用・与信などの判断根拠
  として使ってはいけません。
