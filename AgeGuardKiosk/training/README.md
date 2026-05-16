# 年齢推定モデルの学習ガイド

`age_model.tflite` を自前で学習する手順。**Google Colab の無料 GPU で約 30 分**で完走します。
ローカル GPU は不要。

## 全体の流れ

```
1. UTKFace データセットを Colab にアップロード（約 23,000 枚 / 不要時 200MB）
2. train_age_model.py を実行
3. 出来た age_model.tflite を Mac にダウンロード
4. AgeGuardKiosk/app/src/main/assets/age_model.tflite に置く
5. Android Studio ▶ Run
```

## ステップ詳細

### 1. UTKFace を入手

公式: https://susanqq.github.io/UTKFace/  
ミラー (Kaggle、ログイン要): https://www.kaggle.com/datasets/jangedoo/utkface-new

`UTKFace.tar.gz`（または `crop_part1.tar.gz`）をダウンロード。
ファイル名フォーマットは `[age]_[gender]_[race]_[datetime].jpg`（学習スクリプトはこの形式を前提）。

### 2. Google Colab を開く

https://colab.research.google.com → **新しいノートブック**

メニュー **ランタイム → ランタイムのタイプを変更 → ハードウェア アクセラレータ: T4 GPU** を選択。

### 3. データをアップロード

ノートブックの最初のセルで:

```python
from google.colab import files
uploaded = files.upload()  # UTKFace.tar.gz をアップロード
```

解凍:

```python
!mkdir -p /content/UTKFace
!tar -xzf UTKFace.tar.gz -C /content/UTKFace --strip-components=1
!ls /content/UTKFace | head
```

### 4. 学習スクリプトを取得 & 実行

```python
!wget -q https://raw.githubusercontent.com/azumatori49-max/tori/claude/build-age-estimation-app-hh1wE/AgeGuardKiosk/training/train_age_model.py
!python train_age_model.py
```

進捗ログに `Validation MAE: 5.XX years` 程度が出れば成功。

### 5. モデルをダウンロード

```python
from google.colab import files
files.download("/content/age_model.tflite")
```

### 6. Android プロジェクトに配置

```bash
mv ~/Downloads/age_model.tflite \
   tori/AgeGuardKiosk/app/src/main/assets/age_model.tflite
```

Android Studio で ▶ Run。左上の赤い **DEMO** バッジが消えたら本物のモデルが動いている証拠。

## 期待精度

UTKFace + MobileNetV2 転移学習で **平均誤差 (MAE) 約 5〜7 歳**が標準的。
プロ品質（MAE 3 歳以下）を求めるなら:

- 大規模データセット（IMDB-WIKI 約 50 万枚）に切り替え
- EfficientNet-B0 など強いバックボーンに変更
- AgeDB / MORPH を組み合わせて多様性向上
- 顔のアラインメント（landmark で正規化）

## カスタマイズ

`train_age_model.py` の冒頭 Config:

| 変数 | 意味 | 増やすと |
|---|---|---|
| `EPOCHS_HEAD` | head-only 学習回数 | 過学習リスク↑、精度↑ |
| `EPOCHS_FT` | fine-tune 回数 | 時間↑、精度↑ |
| `BATCH` | バッチサイズ | 速度↑、メモリ消費↑ |
| `IMG_SIZE` | 入力解像度 | 精度↑、推論遅延↑ |

> ⚠️ `IMG_SIZE` を変えたら `AgeEstimator.kt` の `INPUT_SIZE` も合わせて変更してください。

## 入出力スペック（AgeEstimator との契約）

このスクリプトが出力する TFLite は以下:

- 入力: `[1, 224, 224, 3]` float32, RGB, 0..1 正規化
- 出力: `[1, 1]` float32, 推定年齢（回帰）

`AgeEstimator.kt` の `runInference` がこの形式を直接サポートしているため、別途コード修正は不要。
