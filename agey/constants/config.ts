// 年齢ゲートの閾値: AgeRange.Low がこれ未満なら身分証確認を要求する。
// Challenge 25 方式（英国小売業界の慣行）を採用。
export const ID_CHECK_THRESHOLD = 25;

// 自動撮影の間隔 (ミリ秒)。短すぎると API コスト増、長すぎると体感が悪い。
export const CHECK_INTERVAL_MS = 2000;

// 顔が枠内に十分大きく収まっているかの判定 (バウンディングボックスの幅/高さの画像比)。
// これ未満の場合は「もう少し近づいてください」を表示して再試行。
export const MIN_FACE_SIZE_RATIO = 0.22;

// Rekognition が返す信頼度の最小値 (%)。これ未満なら再試行。
export const MIN_FACE_CONFIDENCE = 90;
