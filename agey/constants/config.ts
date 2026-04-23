// 年齢ゲート閾値（鶏ヤロー入口 1次スクリーニング仕様）
//
// 3段階判定:
//   AgeRange.High  < HARD_BLOCK_THRESHOLD → 🛑 入店お断り（明らかな未成年）
//   AgeRange.Low   < ID_CHECK_THRESHOLD   → 🪪 身分証ご提示（グレー）
//   それ以外                               → ✅ お入りください（明らかな成人）

// 推定年齢の上限すらこれ未満なら、確実な未成年とみなす。
// 誤って成人を弾く確率をほぼ 0 にするため保守的に 18 を設定。
export const HARD_BLOCK_THRESHOLD = 18;

// Challenge 25 より緩め（若年層多い店舗で回転率を落とさないため）。
// 明らかな未成年は HARD_BLOCK 側で拾うので、ここは 20 歳前後の境界対応。
export const ID_CHECK_THRESHOLD = 22;

// 結果表示後、自動でスキャン画面へ戻るまでの時間（ミリ秒）。
// 入口キオスクは客が画面に触らない前提なので自動リセットが必須。
export const AUTO_RESET_MS = 3000;

// 自動撮影の間隔 (ミリ秒)。
export const CHECK_INTERVAL_MS = 2000;

// 顔が枠内に十分大きく収まっているかの判定 (画像比)。
export const MIN_FACE_SIZE_RATIO = 0.22;

// Rekognition が返す信頼度の最小値 (%)。これ未満なら再試行。
export const MIN_FACE_CONFIDENCE = 90;
