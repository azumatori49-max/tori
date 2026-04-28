# Models

ここに InsightFace の ONNX モデル 2 ファイルを配置してください。
git にはコミットしません（バイナリで容量が大きいため `.gitignore` 推奨）。

## 必要なファイル

| ファイル名 | 用途 | サイズ目安 |
|---|---|---|
| `scrfd_500m.onnx` | 顔検出 | 約 2.5 MB |
| `genderage.onnx` | 年齢・性別推定 | 約 1.3 MB |

## 取得手順

1. InsightFace の公式リポジトリ（GitHub: deepinsight/insightface）から `buffalo_s` または `buffalo_l` モデルパックを取得
2. パック内から上記 2 ファイルを抽出
3. 本ディレクトリ (`agey/assets/models/`) に配置
4. ファイル名が一致していることを確認

## 注意

- モデルファイルは大きいので git には commit せず、各開発者が個別に配置する運用とします
- `lib/onnxModels.ts` 内で `require('../assets/models/...onnx')` で参照されています
- ファイルが存在しない状態で `pnpm start` するとビルドエラーになります
- `metro.config.js` で `.onnx` 拡張子をアセット登録しているため、配置後はそのまま `require` で読み込めます

## 入手不可の場合

- AFAD で学習されたモデルが必要な場合は、論文（"AFAD: A Large-Scale Asian Face Age Dataset"）の著者公開リポジトリから取得
- 商用 SDK（FaceMe）に切り替える場合は、本ファイルとモデル参照ロジックを差し替えること
