# 🥇 高精度モデルを Kaggle で学習する手順

EfficientNetB0 + DEX 法 + AFAD + UTKFace で **平均誤差 3〜4 歳** を目指します。**完全無料**。

## 全体所要時間

- セットアップ: 15 分
- 学習: 4〜5 時間（裏で放置・寝てる間に回す）
- DL & 配置: 5 分

合計: 実作業 20 分 + GPU 学習 5 時間

---

## ステップ 1: Kaggle アカウント作成

https://www.kaggle.com/ → **Register**

- メールアドレスのみ。クレカ不要。
- 電話番号認証だけ済ませると GPU が解禁される（**Settings → Phone Verification**）

---

## ステップ 2: 新規ノートブック作成

1. 左メニュー **Create → New Notebook**
2. 右側パネル **Settings**:
   - **Accelerator**: `GPU T4 x2` または `GPU P100` を選択
   - **Internet**: `On`（学習中に重みダウンロードが走る）
   - **Persistence**: そのままでOK

---

## ステップ 3: データセットを追加

右側パネル **+ Add Input**（または `+ Add Data`）→ 検索:

### AFAD（アジア人 165k 枚）
検索: **`afad`** または **`afad face age`**
- 候補例: `andredkikulwe/afad-dataset` 等
- 「**Add**」ボタンで追加
- マウントされるパスをメモ（例: `/kaggle/input/afad-dataset/AFAD-Full/`）

### UTKFace（多様性 24k 枚）
検索: **`utkface new`**
- 候補: `jangedoo/utkface-new` がメジャー
- 「Add」
- マウントパス: `/kaggle/input/utkface-new/UTKFace/`

> **データセットの slug は時期によって変動します**。Notebook 左下の **Files** ペインで実際のパスを確認できます。

---

## ステップ 4: スクリプトをコピペ

このリポジトリの `AgeGuardKiosk/training/train_age_model_dex.py` の中身を全選択コピー → Notebook の最初のセルにペースト。

### パス確認

スクリプト冒頭の以下 2 行を、ステップ 3 で確認した実パスに合わせて修正:

```python
AFAD_DIR = "/kaggle/input/afad-full/AFAD-Full"          # ← 実パスに修正
UTKFACE_DIR = "/kaggle/input/utkface-new/UTKFace"       # ← 実パスに修正
```

不安なら最初に確認用セルを実行:

```python
!find /kaggle/input -maxdepth 4 -type d | head -50
```

これで実際のディレクトリ階層が見えます。AFAD は `<age>/<gender>/*.jpg` 構造、UTKFace は `[age]_*.jpg` フラット構造。

---

## ステップ 5: 実行

- セルを選択して **▶ Run All**（または `Run → Run All`）
- もしくは右上 **Save Version → Save & Run All (Commit)** にすると Kaggle のバックグラウンドで実行されてブラウザ閉じても継続

進捗:

```
AFAD: 164432 images
UTKFace: 23708 images
Combined dataset: 188140 images

=== Stage 1: head only ===
Epoch 1/5  loss: ... val_expected_age_mae: 6.2 ...
...

=== Stage 2: fine-tune ===
Epoch 1/12 loss: ... val_expected_age_mae: 4.1 ...
...

Final validation expected-age MAE: 3.8 years
Wrote /kaggle/working/age_model.tflite (16.7 MB)
```

**`Final validation expected-age MAE: 3.5〜4.5 years`** あたりが出れば成功。

---

## ステップ 6: モデルをダウンロード

学習完了後、右側 **Output** タブまたは Notebook 下部 **Files** から:

- `age_model.tflite` を右クリック → **Download**

---

## ステップ 7: Android プロジェクトに配置

Mac のターミナルで:

```bash
mv ~/Downloads/age_model.tflite \
   ~/path/to/tori/AgeGuardKiosk/app/src/main/assets/age_model.tflite
```

Android Studio で **Build → Clean Project → ▶ Run**。

✅ 左上の赤い「DEMO」バッジが消える  
✅ 自分の顔をかざすと実年齢 ±3〜5 歳の値が出る

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `No training data found` | データセットパスがズレてる。`!find /kaggle/input -type d` で確認 |
| `OOM`（メモリ不足） | `BATCH = 64` または `48` に下げる |
| `Session timed out` (12h 超) | Kaggle の 1 セッション 12h 制限。`EPOCHS_FT` を 8 に下げる |
| `val_expected_age_mae` が下がらない | 学習データのパスや label parsing が間違ってる可能性 |
| MAE が 8 以上 | アジア人偏重の異常学習。`SIGMA = 3.0` に上げて再実行 |

---

## さらに精度を上げたい場合

| 改善 | 期待効果 | 追加コスト |
|---|---|---|
| EfficientNetB0 → **B2** | -0.3 歳 | 学習時間 1.5 倍 / TFLite サイズ 2 倍 |
| IMDB-WIKI 追加 | -0.3 歳 | データ 7GB DL、エポック数倍 |
| 顔ランドマークでアラインメント | -0.3 歳 | 前処理スクリプト追加 |
| 5-fold アンサンブル | -0.5 歳 | 学習時間 5 倍、推論ロジック改修 |

このアプリ用途（スタッフ補助）なら**現構成で十分**です。
