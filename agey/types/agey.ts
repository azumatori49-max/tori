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

export type KioskState = {
  face: FaceBox | null;
  estimate: AgeEstimate | null;
  smoothedAge: number | null;
  decision: GateDecision;
};
