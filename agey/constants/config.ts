export const CONFIG = {
  MINOR_THRESHOLD: 20,
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

  // TFLite model: InsightFace buffalo_s genderage (converted via onnx2tf)
  // Input:  [1, 96, 96, 3] float32 NHWC, values in [0, 1]
  // Output: [1, 3] float32 → [gender_female_logit, gender_male_logit, age/100]
  MODEL_INPUT_SIZE: 96,
  MODEL_AGE_OUTPUT_IDX: 2,  // output[0][2] * MODEL_AGE_SCALE = estimated age
  MODEL_AGE_SCALE: 100,
  MODEL_FACE_PADDING: 0.10, // fractional padding added around face bbox
} as const;

export type Config = typeof CONFIG;
