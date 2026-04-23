export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  yawAngle?: number;
  pitchAngle?: number;
  rollAngle?: number;
};

export type AgeEstimate = {
  age: number;
  confidence: number;
  detectedAt: number;
};

export type GateDecision = 'pass' | 'checkId' | 'idle';

export type KioskPhase = 'idle' | 'sampling' | 'analyzing' | 'locked';

/** null = 問題なし、サンプリング可 */
export type SamplingHint = 'tooFar' | 'tooClose' | 'misaligned' | null;

export type KioskState = {
  face: FaceBox | null;
  estimate: AgeEstimate | null;
  smoothedAge: number | null;
  decision: GateDecision;
  phase: KioskPhase;
  progress: number;
  lockedAge: number | null;
  samplingHint: SamplingHint;
};
