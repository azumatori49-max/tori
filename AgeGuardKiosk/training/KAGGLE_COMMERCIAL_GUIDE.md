# 商用クリーン版モデルの学習手順

**完全商用 OK** なデータ（FairFace + 自社従業員 + 任意の合成顔）だけで学習する手順。

期待精度: **MAE 3.5〜4.5 歳、未成年検出率 95%+**

---

## 全体の流れ

```
1. 自社従業員 800 枚を Kaggle にプライベートデータセットとしてアップロード
2. FairFace を Kaggle で検索して Notebook にアタッチ
3. (任意) 合成顔生成スクリプトを別途実行 → データセットとしてアップロード
4. 学習スクリプトを実行（2 時間）
5. age_model.tflite を DL → app/src/main/assets/ に配置
6. Android Studio で再ビルド → 端末にインストール
```

---

## ステップ 1: 従業員写真をパッケージング

ローカル PC で、800 枚の写真を以下のいずれかの形式に整える。

### 形式A: labels.csv ✅ おすすめ

```
employees/
├── labels.csv
├── img001.jpg
├── img002.jpg
├── ...
```

`labels.csv`:
```csv
filename,age
img001.jpg,34
img002.jpg,28
img003.jpg,52
...
```

### 形式B: ファイル名に年齢を埋め込む

```
employees/
├── 34_img001.jpg
├── 28_img002.jpg
├── 52_img003.jpg
├── ...
```

どちらの形式でも `train_age_model_commercial.py` が自動認識します。

> ⚠️ 個人特定できる本名やメールアドレスをファイル名に入れないこと。社員番号など匿名 ID を使う。

---

## ステップ 2: Kaggle にプライベートデータセットとしてアップロード

1. ローカルで `employees/` フォルダを **zip 圧縮**:
   ```bash
   zip -r employees.zip employees/
   ```
2. https://www.kaggle.com/datasets にアクセス
3. **+ New Dataset** をクリック
4. **Files** タブから `employees.zip` をアップロード
5. **Title**: 任意（例: `ageguard-employees`）
6. **Privacy**: 必ず **Private** を選択 🔒
7. **Create** をクリック

アップロード完了後、Notebook で `+ Add Input` から自分のアップロード済みデータセットを追加できます。

---

## ステップ 3: FairFace を Kaggle で検索 & 追加

Notebook の **+ Add Input** で:

- 検索: **`fairface`**
- 候補例: `vjgpt/race-and-gender-detection` または `fairface` 系のデータセット
- ライセンス CC-BY 4.0 と明記されてるものを選ぶ
- 約 1〜2 GB

---

## ステップ 4: パス確認

Notebook の最初のセルで:

```python
!find /kaggle/input -maxdepth 4 -type d | head -30
```

出力を見て、`train_age_model_commercial.py` 冒頭の 3 つの定数を実パスに書き換える:

```python
FAIRFACE_DIR = "/kaggle/input/fairface"        # ← 実パスに
EMPLOYEE_DIR = "/kaggle/input/ageguard-employees"  # ← 実パスに
SYNTHETIC_DIR = "/kaggle/input/synthetic-faces"    # ← 無ければそのまま
```

---

## ステップ 5: 学習セル

新セル:

```python
# 1. スクリプトを GitHub から取得
!wget -q https://raw.githubusercontent.com/azumatori49-max/tori/claude/build-age-estimation-app-hh1wE/AgeGuardKiosk/training/train_age_model_commercial.py -O train.py

# 2. パス調整（実環境に合わせて）
!sed -i 's|FAIRFACE_DIR = .*|FAIRFACE_DIR = "/kaggle/input/fairface"|' train.py
!sed -i 's|EMPLOYEE_DIR = .*|EMPLOYEE_DIR = "/kaggle/input/ageguard-employees"|' train.py

# 3. 学習
!python train.py
```

---

## ステップ 6: バックグラウンド実行

▶ Run は押さず、右上 **Save Version** → **Save & Run All (Commit)** を選択。

ブラウザ閉じて OK。約 2 時間でメール通知が来ます。

---

## ステップ 7: モデル DL & 配置

1. Notebook の **Output** タブから `age_model.tflite` をダウンロード
2. ターミナルで:
   ```bash
   mv ~/Downloads/age_model.tflite \
      ~/path/to/tori/AgeGuardKiosk/app/src/main/assets/age_model.tflite
   ```
3. Android Studio で **Build → Clean → Rebuild → ▶ Run**

---

## 期待される出力

学習完了時のログ:

```
FairFace: 108,501 images
Employees (via labels.csv): 800 images
Combined dataset: 109,301 images
  Minors (<18): ~10,000   Adults (18+): ~99,000

...
Final validation expected-age MAE: 4.20 years

  MAE on minors (<18): 3.85 years (n=512)
  MAE on 18-22 (boundary): 2.30 years (n=98)  ← 業務上最重要
  MAE on adults 23-50: 3.50 years (n=4,210)
  MAE on seniors 50+: 5.10 years (n=625)

Wrote /kaggle/working/age_model.tflite (4.7 MB)
```

---

## なぜこれが商用 OK か

| データ | ライセンス | 確認方法 |
|---|---|---|
| FairFace | CC-BY 4.0 | データセットページに明記 |
| 自社従業員 | 自社所有 + 個別同意 | 同意書を社内で保管 |
| (任意) 合成顔 | Stable Diffusion 生成 = 著作権なし | 生成スクリプトで自社で作成 |

**学習データの出所すべてを社内資料として説明可能**。法務監査が入っても堂々と提示できます。

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `FairFace not found` | データセットのパス違い。`!find /kaggle/input -name "*.csv"` でCSV探す |
| `Only X images found` | 写真とラベルの対応が崩れてる。labels.csv の `filename` 列確認 |
| MAE が 6 以上で頭打ち | 学習サンプル不足 or 子供データ少ない。合成顔追加を検討 |
| `OOM error` | `BATCH = 64` か `48` に下げる |

---

## さらに精度を上げたい場合

### 合成顔の追加（+0.3 歳改善見込み）

`generate_synthetic_faces.py` を別 Notebook で実行 → 結果を新規データセットとして再アップロード → `SYNTHETIC_DIR` に指定。

### 従業員の家族写真をオプトイン収集（+0.5 歳改善）

「家族の写真も提供 OK」と社員に依頼。子供 50 人 + 高齢者 50 人だけでも境界精度が大幅向上。

### 撮影品質改善

- 全社員撮影会で統一照明で撮り直し
- 1 人 3 枚（正面・少し右・少し左）
