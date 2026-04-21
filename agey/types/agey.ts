export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AgeEstimate = {
  age: number;
  confidence: number;
  detectedAt: number;
};

export type GateDecision = 'pass' | 'checkId' | 'idle';

export type KioskPhase = 'idle' | 'sampling' | 'locked';

export type KioskState = {
  face: FaceBox | null;
  estimate: AgeEstimate | null;
  smoothedAge: number | null;
  decision: GateDecision;
  phase: KioskPhase;
  /** サンプリング中の進捗 (0..1), 確定後は 1 */
  progress: number;
  /** 確定した年齢 (locked フェーズでのみセット) */
  lockedAge: number | null;
};
