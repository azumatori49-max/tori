// エイジー: 推定年齢を表示するだけのキオスクアプリ設定。
// 判定ロジックなし、ログ保存なし、推定→即破棄。

// 結果表示後、自動でスキャン画面へ戻るまでの時間（ミリ秒）。
export const AUTO_RESET_MS = 3000;

// 自動撮影の間隔 (ミリ秒)。並列化したのでカメラのシャッター速度が事実上の下限。
export const CHECK_INTERVAL_MS = 600;

// 顔が枠内に十分大きく収まっているかの判定 (画像比)。
export const MIN_FACE_SIZE_RATIO = 0.22;

// Rekognition が返す信頼度の最小値 (%)。
export const MIN_FACE_CONFIDENCE = 90;

// ── 撮影品質ゲート（推定精度を上げるための前処理フィルタ）────────
export const MIN_BRIGHTNESS = 35;
export const MAX_BRIGHTNESS = 95;
export const MIN_SHARPNESS = 50;
export const MAX_POSE_YAW = 25;
export const MAX_POSE_PITCH = 25;
export const MAX_POSE_ROLL = 25;

// ── 多数決サンプリング ───────────────────────────
export const SAMPLE_COUNT = 5;
export const SAMPLE_TRIM = 1;
export const SAMPLE_RESET_AFTER_MISSES = 2;

// ── 撮影解像度・JPEG圧縮 ─────────────────────────
export const CAPTURE_WIDTH = 600;
export const JPEG_QUALITY = 0.85;
export const CAMERA_QUALITY = 0.7;
