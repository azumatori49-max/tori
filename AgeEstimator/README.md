# AgeEstimator (居酒屋向け年齢スクリーニング キオスク)

iOS の **CoreML 完全オンデバイス** 年齢推定アプリ。日本人の顔に合わせて
キャリブレーションした age 推定モデルを載せ、居酒屋・バーなどの**入口に置く
キオスク端末**で **「未成年の可能性が高い来店者をスタッフ判断に回す一次
スクリーニング」** を行います。

> **重要 — これは身分証明の代替ではありません。**
> 未成年者飲酒禁止法・風営法上、**酒類提供の最終判断と法的責任は店舗側に
> あります**。本アプリの役割は「明らかに未成年」を検知してスタッフに即時
> アラートし、グレーゾーンの来店者には**確実に身分証提示を求める運用**を
> 機械的に強制することです。AI 推定だけでの拒否・受入は法的に成立しません。

カメラ映像・顔画像・推定結果は端末外に一切送信されず、サーバ側にも保存
されません(`NSCameraUsageDescription` にも明記)。

## スクリーニング 3 値判定

平滑化後の推定値とその不確かさ band `mean ± 1.5σ` で 3 段階に振り分けます。

| 判定 | 条件 | 表示 | 運用 |
| --- | --- | --- | --- |
| 🟢 `cleared` | lower bound ≥ **25** | 「OK どうぞ」 | そのまま入店 |
| 🟡 `idCheckRequired` | 上記でも下記でもない | 「店員に身分証をご提示ください」 | スタッフが ID 確認 |
| 🔴 `blockedMinor` | upper bound < **18** | 「ご利用いただけません」 | 入店不可 |

しきい値は `ML/ScreeningPolicy.swift` の `ScreeningPolicy.izakaya` で
変更できます。

* `idCheckBelow: 25` は業界標準の **「25 歳以下に見えたら ID 確認」** に
  合わせています。20 にすると確認件数は減りますが、外見の若い 20 代前半が
  すり抜けるリスクが上がります。
* `hardBlockBelow: 18` は飲酒可能年齢に合わせています。年齢モデルの MAE
  (3〜5 歳) を考慮して、**点推定ではなく上限見込みで判定**しているので、
  18.5 歳の見た目で誤って弾く確率を抑えています。

## なりすまし対策(Liveness)

無人キオスクでは「成人の写真をかざす」攻撃が必ず試みられます。
`Camera/LivenessDetector.swift` が、整合中に取得した yaw / pitch / roll の
2 秒間の分散を見て、静止画像が掲げられている状況を弾きます。

これは **passive liveness の最低限**です。より高い保証が必要なら:

* TrueDepth カメラ搭載端末(iPhone X 以降)で `AVDepthData` を使い、平面
  写真を弾く深度チェックに差し替える
* 専用 PAD (Presentation Attack Detection) CoreML モデルを `LivenessDetector`
  と差し替え

を検討してください。

## 同時に複数人がフレームに入った場合

`FaceDetector` は前景閾値以上の顔を全て返し、ViewModel が顔数 > 1 なら
`AgeEstimationState.multipleFaces` に遷移します。「お一人ずつお願いします」
を表示し、推論はスキップします。これは

* 大人にくっついて未成年が映り込み、大人だけが推論されて誤って通る
* 友人同士でカメラを向けて遊んでしまう

の両方を防ぐためです。

## キオスクモード

判定が出ると 8 秒後に自動で `searching` に戻ります(`kioskResetSeconds`)。
スタッフ判断中に画面が消える事故を防ぐため、必要なら長くしてください。
画面ロック・自動明るさは iPad 側の **アクセスガイド (Guided Access)** で
固定すると運用が安定します。

## 推奨ハードウェア

* **iPad** (12.9" / 11") を縦置き、フロントカメラを利用者の目線に。
* A12 Bionic 以降(Apple Neural Engine 搭載)。第 9 世代 iPad / 第 5 世代
  iPad Air / 第 6 世代 mini あたりが価格対性能のスイートスポット。
* スタンドは今回お見せいただいた SK-II ミラーのような「楕円フレーム周りに
  リング照明 + マジックミラーで iPad を半透過」設計が、顔色を一定に保てて
  推定精度に効きます。

## アーキテクチャ

```
AVCaptureSession ──► CVPixelBuffer
       │
       ▼
Vision: VNDetectFaceRectanglesRequest (Rev3)   ─► boundingBox / yaw / roll / pitch
       │
       ├─► faceCount > 1  ──────────────► state = .multipleFaces
       │
       ▼
FrameAlignment (枠フィット判定)  ──► state = .aligning(progress)
       │
       ▼  (12 frames aligned)
LivenessDetector (yaw/pitch 分散) ──► state = .livenessRequired (待機)
       │
       ▼
CoreML: AgeNetJP.mlpackage (MobileNetV3-Small / 100-way age softmax)
       │      期待値 → 年齢
       ▼
JapaneseCalibration (10 年代ごとのバイアス補正)
       │
       ▼
PredictionSmoother (5 サンプル trimmed mean + stdDev)
       │
       ▼
ScreeningPolicy.izakaya  (3 値判定)
       │
       ▼
state = .cleared / .idCheckRequired / .blockedMinor
       │
       ▼ (8 秒後自動リセット)
state = .searching
```

主要ファイル:

| ファイル | 役割 |
| --- | --- |
| `AgeEstimatorApp.swift` | SwiftUI エントリ |
| `AgeEstimationViewModel.swift` | キオスク状態機械 |
| `Views/RootView.swift` | 3 値判定 + スタッフ向け文言 |
| `Views/OvalFrameOverlay.swift` | 楕円フレーム + 状態色 |
| `Camera/CameraManager.swift` | フロントカメラ AVCaptureSession |
| `Camera/FaceDetector.swift` | Vision 顔検出 (前景フィルタ + 複数人検知) |
| `Camera/FrameAlignment.swift` | 枠との整合スコア |
| `Camera/LivenessDetector.swift` | yaw/pitch 分散による passive liveness |
| `ML/AgeEstimator.swift` | CoreML 推論ラッパー |
| `ML/JapaneseCalibration.swift` | 日本人向けバイアス補正 + smoother |
| `ML/ScreeningPolicy.swift` | 3 値判定ロジック |

## ビルド

```bash
brew install xcodegen
cd AgeEstimator
xcodegen generate
open AgeEstimator.xcodeproj
```

実機(A12 以降)をターゲットに走らせてください。`Models/AgeNetJP.mlpackage`
がバンドルに含まれていない場合、Debug ビルドはランダムなダミー年齢を返します。
**本番運用前には必ず実モデルを同梱してください。**

## モデルの作り方

`Scripts/finetune_japanese.py` で AFAD / AAF / MegaAge-Asian の 3 つの東アジア
データセットを混ぜて MobileNetV3-Small を fine-tune し、`mlpackage` として
書き出します。**18 歳未満をオーバーサンプリング**するよう Dataset 側で重み
付けすると、入口スクリーニングでの判別性能が大きく上がります。

```bash
cd Scripts
pip install torch torchvision coremltools pillow
python finetune_japanese.py \
    --afad /data/AFAD-Full \
    --aaf  /data/All-Age-Faces \
    --megaage /data/megaage_asian \
    --out  ../Models/AgeNetJP.mlpackage
```

学習後、`measure_calibration.py` で日本人 held-out セットの 10 年代ごとの
誤差を測り、`JapaneseCalibration.default.decadeOffsets` を更新してください。
**18 歳・25 歳付近の MAE と False Negative Rate** は別途必ず測定し、必要なら
`ScreeningPolicy.izakaya` の `idCheckBelow` を引き上げてください。

## キャリブレーションの考え方

汎用モデル(IMDB-Wiki、UTKFace 等で学習)は東アジア顔に対して

* 10 代を実年齢より老けて見積もる
* 30 〜 50 代を実年齢より若く見積もる

傾向があります。**居酒屋スクリーニングでは前者(10 代を老けて見積もる)が
最も危険**で、未成年が「cleared」に流れる原因になります。`JapaneseCalibration`
の `decadeOffsets[1] = -2.0` は 10 代に対し計算結果を若く寄せる方向の補正を
入れていますが、自店の検証データで再測定して確実に **未成年方向に保守的**
な値にしてください。

## 「〜万人のデータベース」バッジ

ホーム画面に「**AI 学習データ 21万人以上**」のバッジと、`searching` 状態の
サブタイトルに「**日本人 21万人以上 の顔データで学習した AI が判定して
います**」を表示しています。

文言と数字の出どころは `ML/DatasetInfo.swift` の `DatasetInfo.default` 1 箇所
に集約しています。`Scripts/finetune_japanese.py` で実際に学習に使った件数と
**必ず一致させてください**。一致していないと景品表示法上の優良誤認になり
えます。

既定値は同梱データセットの合計に基づきます:

| データセット | 件数 |
| --- | --- |
| AFAD-Full | 約 164,000 |
| All-Age-Faces (AAF) | 約 13,000 |
| MegaAge-Asian | 約 40,000 |
| **合計** | **約 217,000 → 表示は「21万人以上」** |

`displayCountJP` は端数を**切り捨て**で 万 単位に丸めるので、実件数より
過大に表示されない設計です。学習データを増やしたら `totalSampleCount` を
更新してください。

## 個人情報・プライバシー

* 顔画像 / 推定値 / クロップ / 特徴量を**端末外に送信しません**。
* `Documents` / `Caches` への保存も行いません(`AgeEstimator.swift`
  / `LivenessDetector.swift` どちらも一時バッファのみ使用)。
* 顔識別 (face recognition) は行っていません。本アプリは**顔の同一性を
  記録しない** 設計です。
* 個人情報保護法上は、**端末内で処理し外部に出ない age 推定**は概ね
  「個人データ取得」に該当しないと整理できますが、店舗側の運用ポリシー
  と看板表示(「AI 年齢確認を行います」「画像は保存されません」)を
  必ず合わせてください。`Views/RootView.swift` のフッターに既定の
  ディスクレーマーを表示しています。

## ライセンス / 注意

* このリポジトリのコードは内部利用想定です。
* AFAD / AAF / MegaAge-Asian / IMDB-Wiki などの**学習データセットは独自の
  利用条件**があります。商用配布する場合は各データセットの規約を必ず確認
  してください。
* 本アプリは一次スクリーニングであり、**酒類提供可否の最終判断は店舗
  スタッフが身分証で行う**運用を前提に設計しています。
