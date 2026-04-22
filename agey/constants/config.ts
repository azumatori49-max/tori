export const CONFIG = {
  MINOR_THRESHOLD: 20,
  /** 居酒屋の客として想定される最小年齢。これ未満の推定値は切り上げる */
  MIN_CUSTOMER_AGE: 14,
  SMOOTHING_WINDOW: 8,
  LOCK_AFTER_MS: 2000,
  IDLE_TIMEOUT_MS: 1500,
  MIN_SAMPLES_FOR_DECISION: 4,
  FRAME_PROCESSOR_FPS: 6,

  /** 顔が小さすぎる下限 (これ未満 → "近づいてください") */
  MIN_FACE_RATIO: 0.15,

  /** 顔が近すぎる上限 (これ超え → "離れてください") */
  MAX_FACE_RATIO: 0.50,

  MAX_YAW_ANGLE: 20,
  MAX_PITCH_ANGLE: 15,
  MAX_ROLL_ANGLE: 20,

  DEV_MOCK_ESTIMATOR: true,
} as const;

export type Config = typeof CONFIG;
