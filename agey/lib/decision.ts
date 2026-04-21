import { CONFIG } from '@/constants/config';
import type { GateDecision } from '@/types/agey';

export function decideGate(smoothedAge: number | null, samples: number): GateDecision {
  if (smoothedAge === null || samples < CONFIG.MIN_SAMPLES_FOR_DECISION) {
    return 'idle';
  }
  if (smoothedAge < CONFIG.MINOR_THRESHOLD) {
    return 'checkId';
  }
  return 'pass';
}
