# 合成顔の生成手順

Stable Diffusion で約 3,000 枚の年齢ラベル付き合成顔を生成して、商用 OK の学習データとして使う。

期待効果: FairFace 単体比で **MAE -1.0〜-1.5 歳** 改善。

## ライセンス

| 使うもの | ライセンス | 商用利用 |
|---|---|---|
| Stable Diffusion 1.5 | CreativeML Open RAIL-M | ✅ OK |
| 生成された画像 | 著作権発生せず（実在しない人物） | ✅ OK |

学習データとして社内で堂々と使えます。

---

## 手順

### ステップ 1: Kaggle で新しい Notebook を作成

1. https://www.kaggle.com → **Create → New Notebook**
2. 右側パネル:
   - **Accelerator**: `GPU T4 x2` または `P100`
   - **Internet**: `On`（モデル DL に必要）

> 既存の学習用 Notebook と**別に作る**のがおすすめ。生成と学習を分離できる。

### ステップ 2: 依存ライブラリインストール + スクリプト DL

セルを 1 個用意して以下を貼り付け:

```python
!pip install -q diffusers transformers accelerate

!wget -q https://raw.githubusercontent.com/azumatori49-max/tori/claude/build-age-estimation-app-hh1wE/AgeGuardKiosk/training/generate_synthetic_faces.py -O generate.py

!python generate.py
```

### ステップ 3: バックグラウンド実行

▶ Run は押さず:
1. 右上 **Save Version** → **Save & Run All (Commit)** を選択
2. **Save**
3. ブラウザ閉じてOK

約 **2 時間後**にメール通知（3,000 枚生成）。

### ステップ 4: 生成画像を確認

Notebook が完了したら **Output** タブで `synthetic_faces/` フォルダを確認。

サンプルとして数枚ダウンロードしてみて、

- 顔がちゃんと写ってる ✅
- 年齢が大体一致してる ✅
- 不自然な変形がない ✅

を目視確認。

> 子供（特に 3-7 歳）は不自然になることがあります。学習時にデータ拡張で吸収される範囲なので OK。

### ステップ 5: zip して新規データセットとしてアップロード

Notebook の Output から `synthetic_faces` フォルダ全体をダウンロードするか、新セルで:

```python
import shutil
shutil.make_archive('/kaggle/working/synthetic_faces', 'zip', '/kaggle/working/synthetic_faces')
```

→ `/kaggle/working/synthetic_faces.zip` ができる → ダウンロード。

その後 https://www.kaggle.com/datasets → **+ New Dataset**:
- **Title**: `ageguard-synthetic-faces`
- **Privacy**: **Private**（自社内用）
- アップロード後、メモしておく（次の学習で使う）

### ステップ 6: 学習用 Notebook に追加

商用学習 Notebook の **+ Add Input** から、今アップロードしたデータセットを追加。

`train_age_model_commercial.py` の冒頭で:

```python
SYNTHETIC_DIR = "/kaggle/input/ageguard-synthetic-faces"  # 実パスに調整
```

---

## カスタマイズ

`generate.py` の `AGE_PLAN` を編集:

```python
AGE_PLAN = {
    (3, 7):    400,    # ←枚数を増やせば子供精度↑
    (8, 12):   400,
    (13, 17):  400,
    (18, 22):  400,    # ←境界年齢、増やすと効く
    (23, 30):  300,
    (31, 45):  400,
    (46, 60):  400,
    (61, 75):  300,
}
```

合計 3,000 枚で約 2 時間。倍の 6,000 枚なら約 4 時間。

`ETHNICITIES` リストも調整可能:
```python
# 日本市場特化なら:
ETHNICITIES = ["Japanese", "Korean", "Chinese"]
```

→ アジア人顔が強くなる代わりに多様性が下がる。

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `CUDA out of memory` | `IMG_SIZE = 384` に下げる |
| 生成が遅すぎる | `NUM_INFERENCE_STEPS = 20` に下げる |
| 子供がリアルすぎて気持ち悪い | プロンプトに `cartoon style` を入れる手もあるけど精度↓ |
| 顔が映ってない画像が混ざる | 学習時は気にしなくてよい（ノイズとして吸収される） |
