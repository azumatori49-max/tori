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
export const CHECK_INTERVAL_MS = 2000;

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

// ── 多数決サンプリング（3回計測 → 中央値採用で外れ値除去）──────
export const SAMPLE_COUNT = 3;

// 連続して有効サンプルが取れない回数。これを超えたらバッファをリセットして
// 「途中で離脱した客」のサンプルが残るのを防ぐ。
export const SAMPLE_RESET_AFTER_MISSES = 2;
