export const CONFIG = {
  MINOR_THRESHOLD: 20,
  /** 居酒屋の客として想定される最小年齢。これ未満の推定値は切り上げる */
  MIN_CUSTOMER_AGE: 14,
  SMOOTHING_WINDOW: 8,
  /** 顔が安定してからAPIを呼ぶまでの時間 (ms) */
  LOCK_AFTER_MS: 1500,
  IDLE_TIMEOUT_MS: 1500,
  MIN_SAMPLES_FOR_DECISION: 1,
  FRAME_PROCESSOR_FPS: 6,

  /** 顔が小さすぎる下限 (これ未満 → "近づいてください") */
  MIN_FACE_RATIO: 0.15,

  /** 顔が近すぎる上限 (これ超え → "離れてください") */
  MAX_FACE_RATIO: 0.50,

  MAX_YAW_ANGLE: 20,
  MAX_PITCH_ANGLE: 15,
  MAX_ROLL_ANGLE: 20,

  /**
   * Azure Face API
   * 取得先: https://portal.azure.com → Cognitive Services → Face
   * Free tier: 30,000 calls/month
   */
  AZURE_FACE_ENDPOINT: 'https://YOUR_RESOURCE_NAME.cognitiveservices.azure.com',
  AZURE_FACE_KEY: 'YOUR_KEY_HERE',

  /** true の間はモックで動く（Azureキーなし開発用） */
  DEV_MOCK_ESTIMATOR: true,
} as const;

export type Config = typeof CONFIG;
