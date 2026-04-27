// 年齢ゲート閾値（鶏ヤロー入口 1次スクリーニング仕様）
//
// 3段階判定:
//   AgeRange.High  < HARD_BLOCK_THRESHOLD → 🛑 入店お断り（明らかな未成年）
//   AgeRange.Low   < ID_CHECK_THRESHOLD   → 🪪 身分証ご提示（グレー）
//   それ以外                               → ✅ お入りください（明らかな成人）

export const HARD_BLOCK_THRESHOLD = 18;
export const ID_CHECK_THRESHOLD = 22;

// 結果表示後、自動でスキャン画面へ戻るまでの時間（ミリ秒）。
export const AUTO_RESET_MS = 3000;

// 自動撮影の間隔 (ミリ秒)。
// サンプル数を 5 に増やしつつ総計測時間を 7〜8 秒に抑えるため 1500 ms に短縮。
export const CHECK_INTERVAL_MS = 1500;

// 顔が枠内に十分大きく収まっているかの判定 (画像比)。
export const MIN_FACE_SIZE_RATIO = 0.22;

// Rekognition が返す信頼度の最小値 (%)。
export const MIN_FACE_CONFIDENCE = 90;

// ── 撮影品質ゲート（推定精度を上げるための前処理フィルタ）────────
// Rekognition の Quality は 0-100 のスコア。
export const MIN_BRIGHTNESS = 35; // 暗すぎる写真を弾く
export const MAX_BRIGHTNESS = 95; // 白飛びを弾く
export const MIN_SHARPNESS = 50; // ボケ画像を弾く

// 顔の向き (degree)。Yaw=左右, Pitch=上下, Roll=傾き。
// 正面から大きく外れたフレームは推定誤差が拡大するため除外。
export const MAX_POSE_YAW = 25;
export const MAX_POSE_PITCH = 25;
export const MAX_POSE_ROLL = 25;

// ── 多数決サンプリング（5回計測 → 上下を除外したトリム平均で外れ値除去）──
// サンプル数を増やすほど精度は上がるが、入口の回転率を考慮して 5 回に制限。
export const SAMPLE_COUNT = 5;

// トリム平均で除外する両端のサンプル数。SAMPLE_COUNT=5 で TRIM=1 なら
// 最大値 1 つ・最小値 1 つを捨て、中央 3 つの平均を採用する。
export const SAMPLE_TRIM = 1;

// ── 撮影解像度・JPEG圧縮（高品質化で推定誤差を下げる）─────────
// 480px は顔特徴の解像度不足になりがち。720px に拡大すると精度が向上する。
export const CAPTURE_WIDTH = 720;

// JPEG圧縮率。0.7 だと圧縮ノイズで肌のテクスチャが失われやすい。
// 0.85 に上げて Rekognition が肌の状態（しわ・毛穴・産毛）を読み取りやすくする。
export const JPEG_QUALITY = 0.85;

// CameraView.takePictureAsync の quality 値（カメラセンサー側の品質）。
export const CAMERA_QUALITY = 0.7;

// 連続して有効サンプルが取れない回数。これを超えたらバッファをリセットして
// 「途中で離脱した客」のサンプルが残るのを防ぐ。
export const SAMPLE_RESET_AFTER_MISSES = 2;
