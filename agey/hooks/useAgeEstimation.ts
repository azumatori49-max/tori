import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '@/constants/config';
import { AgeBuffer } from '@/lib/ageBuffer';
import { createMockEstimator } from '@/lib/ageEstimator';
import { decideGate } from '@/lib/decision';
import type { FaceBox, KioskState, SamplingHint } from '@/types/agey';

const INITIAL_STATE: KioskState = {
  face: null,
  estimate: null,
  smoothedAge: null,
  decision: 'idle',
  phase: 'idle',
  progress: 0,
  lockedAge: null,
  samplingHint: null,
};

function getSamplingHint(face: FaceBox, frameWidth: number): SamplingHint {
  const ratio = face.width / Math.max(frameWidth, 1);
  if (ratio < CONFIG.MIN_FACE_RATIO) return 'tooFar';
  if (ratio > CONFIG.MAX_FACE_RATIO) return 'tooClose';
  const { yawAngle, pitchAngle, rollAngle } = face;
  if (yawAngle !== undefined && Math.abs(yawAngle) > CONFIG.MAX_YAW_ANGLE) return 'misaligned';
  if (pitchAngle !== undefined && Math.abs(pitchAngle) > CONFIG.MAX_PITCH_ANGLE) return 'misaligned';
  if (rollAngle !== undefined && Math.abs(rollAngle) > CONFIG.MAX_ROLL_ANGLE) return 'misaligned';
  return null;
}

export function useAgeEstimation() {
  // Mock estimator: used when DEV_MOCK_ESTIMATOR=true or as fallback when TFLite returns null
  const mockEstimator = useMemo(() => createMockEstimator(), []);
  const bufferRef = useRef(new AgeBuffer(CONFIG.SMOOTHING_WINDOW));
  const samplingStartedAtRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<KioskState>(INITIAL_STATE);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const resetToIdle = useCallback(() => {
    bufferRef.current.clear();
    samplingStartedAtRef.current = null;
    clearIdleTimer();
    setState(INITIAL_STATE);
  }, [clearIdleTimer]);

  const scheduleIdleReset = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(resetToIdle, CONFIG.IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, resetToIdle]);

  // estimatedAge: number from TFLite inference (real mode), or null (mock/fallback)
  const onFaceDetected = useCallback(
    (face: FaceBox | null, estimatedAge: number | null, frameWidth: number) => {
      if (!face) {
        scheduleIdleReset();
        return;
      }
      clearIdleTimer();

      const hint = getSamplingHint(face, frameWidth);

      if (hint !== null) {
        bufferRef.current.clear();
        samplingStartedAtRef.current = null;
        setState({ ...INITIAL_STATE, face, phase: 'sampling', samplingHint: hint });
        return;
      }

      setState((prev) => {
        if (prev.phase === 'locked') {
          return prev.face === face ? prev : { ...prev, face };
        }

        // Use TFLite result when available; fall back to mock estimator
        const rawAge =
          estimatedAge !== null
            ? estimatedAge
            : CONFIG.DEV_MOCK_ESTIMATOR
              ? mockEstimator.estimate(face, frameWidth)?.age ?? null
              : null; // production TFLite failure → skip frame

        if (rawAge === null) return prev;

        const estimate = { age: rawAge, confidence: estimatedAge !== null ? 0.9 : 0.5, detectedAt: Date.now() };
        bufferRef.current.push(estimate);
        const smoothedAge = bufferRef.current.median();

        if (samplingStartedAtRef.current === null) {
          samplingStartedAtRef.current = Date.now();
        }
        const elapsed = Date.now() - samplingStartedAtRef.current;
        const progress = Math.min(1, elapsed / CONFIG.LOCK_AFTER_MS);
        const shouldLock =
          elapsed >= CONFIG.LOCK_AFTER_MS &&
          bufferRef.current.size() >= CONFIG.MIN_SAMPLES_FOR_DECISION;

        if (shouldLock && smoothedAge !== null) {
          return {
            face, estimate, smoothedAge,
            decision: decideGate(smoothedAge, bufferRef.current.size()),
            phase: 'locked', progress: 1, lockedAge: smoothedAge, samplingHint: null,
          };
        }

        return {
          face, estimate, smoothedAge,
          decision: 'idle', phase: 'sampling', progress, lockedAge: null, samplingHint: null,
        };
      });
    },
    [clearIdleTimer, mockEstimator, scheduleIdleReset],
  );

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer]);

  return { state, onFaceDetected };
}
