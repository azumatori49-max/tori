/**
 * エイジー 設定値
 *
 * 居酒屋入口キオスク用途:
 *   推定年齢 < MINOR_THRESHOLD → 🔴 ID確認
 *   それ以外                  → 🟢 ご入店どうぞ
 *
 * 推定には ±4〜6 歳程度の誤差があるため、安全側に倒したい場合は
 * MINOR_THRESHOLD を 22 など上乗せして運用する余地あり。
 */
export const CONFIG = {
  /** ID確認を要求する推定年齢の上限 (この値未満で赤) */
  MINOR_THRESHOLD: 20,

  /** 推定値の移動平均サンプル数 */
  SMOOTHING_WINDOW: 8,

  /** 顔を継続検出してから年齢を確定させるまでのミリ秒 */
  LOCK_AFTER_MS: 2000,

  /** 顔未検出からアイドル表示に戻るまでのミリ秒 */
  IDLE_TIMEOUT_MS: 1500,

  /** 判定表示を確定させる最小サンプル数 */
  MIN_SAMPLES_FOR_DECISION: 4,

  /** フレーム処理の目標FPS (高いほど滑らか、負荷増) */
  FRAME_PROCESSOR_FPS: 6,

  /** 顔が小さすぎる場合は無視 (顔幅 / 画面幅) */
  MIN_FACE_RATIO: 0.12,

  /**
   * 実モデル未配置時のモック動作。
   * true の間は顔サイズから擬似的な年齢を算出する (動作確認用)。
   * assets/models/age_model.tflite を配置したら false にして下さい。
   */
  DEV_MOCK_ESTIMATOR: true,
} as const;

export type Config = typeof CONFIG;
