import { useCallback, useEffect, useRef, useState } from 'react';
import { CONFIG } from '@/constants/config';
import { estimateAgeFromPhoto } from '@/lib/cloudAgeApi';
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

export function useAgeEstimation(capturePhoto: () => Promise<string | null>) {
  const [state, setState] = useState<KioskState>(INITIAL_STATE);

  // refs to avoid recreating onFaceDetected on every state change
  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;

  const samplingStartedAtRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureTriggeredRef = useRef(false);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
  }, []);

  const resetToIdle = useCallback(() => {
    samplingStartedAtRef.current = null;
    captureTriggeredRef.current = false;
    clearIdleTimer();
    setState(INITIAL_STATE);
  }, [clearIdleTimer]);

  const scheduleIdleReset = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(resetToIdle, CONFIG.IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, resetToIdle]);

  // When phase transitions to 'analyzing', take photo and call API
  useEffect(() => {
    if (state.phase !== 'analyzing') return;
    let cancelled = false;

    async function run() {
      const path = await capturePhoto();
      if (cancelled) return;
      if (!path) { resetToIdle(); return; }

      try {
        const rawAge = await estimateAgeFromPhoto(path);
        if (cancelled) return;
        const age = Math.max(CONFIG.MIN_CUSTOMER_AGE, Math.round(rawAge));
        setState((prev) => ({
          ...prev,
          phase: 'locked',
          lockedAge: age,
          smoothedAge: age,
          decision: decideGate(age, 1),
          progress: 1,
        }));
      } catch {
        if (!cancelled) resetToIdle();
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [state.phase, capturePhoto, resetToIdle]);

  const onFaceDetected = useCallback(
    (face: FaceBox | null, frameWidth: number) => {
      const phase = phaseRef.current;

      // Keep face position updated while locked
      if (phase === 'locked') {
        if (face) setState((prev) => (prev.face === face ? prev : { ...prev, face }));
        else scheduleIdleReset();
        return;
      }

      // Ignore face updates while API is running
      if (phase === 'analyzing') return;

      if (!face) {
        scheduleIdleReset();
        return;
      }
      clearIdleTimer();

      const hint = getSamplingHint(face, frameWidth);

      if (hint !== null) {
        samplingStartedAtRef.current = null;
        captureTriggeredRef.current = false;
        setState({ ...INITIAL_STATE, face, phase: 'sampling', samplingHint: hint });
        return;
      }

      // Face is good — accumulate stable time
      if (samplingStartedAtRef.current === null) samplingStartedAtRef.current = Date.now();
      const elapsed = Date.now() - samplingStartedAtRef.current;
      const progress = Math.min(1, elapsed / CONFIG.LOCK_AFTER_MS);

      if (elapsed >= CONFIG.LOCK_AFTER_MS && !captureTriggeredRef.current) {
        captureTriggeredRef.current = true;
        setState((prev) => ({ ...prev, face, phase: 'analyzing', progress: 1, samplingHint: null }));
        return;
      }

      setState((prev) => ({
        ...prev, face, phase: 'sampling', progress, samplingHint: null,
      }));
    },
    [clearIdleTimer, scheduleIdleReset],
  );

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer]);

  return { state, onFaceDetected };
}
