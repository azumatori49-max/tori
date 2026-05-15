# 年齢推定モデルのセットアップ

`app/src/main/assets/age_model.tflite` に TFLite モデルを配置してください。
ファイルが存在しない場合、アプリは自動的に **モックモード** で起動します（クラッシュしません）。

## モデル候補（優先順）

### 1. TFLite Hub の年齢推定モデル
[TensorFlow Hub](https://www.kaggle.com/models?framework=tfLite) から年齢推定モデルを検索・ダウンロード。

### 2. HuggingFace の UTKFace ベース TFLite モデル
[HuggingFace](https://huggingface.co/models?search=utkface) で `utkface` や `age estimation tflite` などで検索。
代表的データセット: [UTKFace](https://susanqq.github.io/UTKFace/)（**約 2 万枚 / 0〜116 歳**）。

### 3. MobileNetV2 ベース年齢推定モデル
UTKFace 等で fine-tune した MobileNetV2 を TFLite 変換。

## 入出力フォーマットの前提

`AgeEstimator.kt` は以下を前提に書かれています:

- 入力: `[1, 224, 224, 3]` Float32, RGB, 0〜1 正規化
- 出力:
  - **回帰** (`[1, 1]`): そのまま整数年齢にして表示
  - **分類** (`[1, N]`, N=年齢クラス数): softmax 期待値を年齢として表示

別フォーマット（量子化済み uint8、別解像度など）の場合は `AgeEstimator.INPUT_SIZE` と前処理を修正してください。

## 配置手順

```bash
# 例: UTKFace ベースの TFLite をダウンロードして配置
cp /path/to/age_model.tflite AgeGuardKiosk/app/src/main/assets/age_model.tflite
```

## 学習データ数を画面表示に反映する

UI 下部に「**N 万人のデータをもとに推定しています**」というキャッチコピーを表示しています。
モデル確定後、実際の学習データ数を調べて反映してください。

1. 採用したモデルの**学習データ数**を調査（README / model card / 論文）
2. 万人単位に換算（例: UTKFace 約 23,708 枚 → `2`、IMDB-WIKI 約 50 万枚 → `50`）
3. `app/src/main/res/values/strings.xml` の `training_data_count` を更新

```xml
<string name="training_data_count">2</string>
```

## モックモードについて

`assets/age_model.tflite` が存在しない場合:

- アプリは正常起動する
- 顔検出時に `Random(15..65)` を返す
- ログに `AgeEstimator running in MOCK mode` が出力される

開発・デモ用途で便利です。
