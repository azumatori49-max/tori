import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '@/constants/config';
import { AgeBuffer } from '@/lib/ageBuffer';
import { createEstimator } from '@/lib/ageEstimator';
import { decideGate } from '@/lib/decision';
import type { FaceBox, KioskState } from '@/types/agey';

const INITIAL_STATE: KioskState = {
  face: null,
  estimate: null,
  smoothedAge: null,
  decision: 'idle',
  phase: 'idle',
  progress: 0,
  lockedAge: null,
  aligned: false,
};

function isFaceAligned(face: FaceBox): boolean {
  const { yawAngle, pitchAngle, rollAngle } = face;
  if (yawAngle !== undefined && Math.abs(yawAngle) > CONFIG.MAX_YAW_ANGLE) return false;
  if (pitchAngle !== undefined && Math.abs(pitchAngle) > CONFIG.MAX_PITCH_ANGLE) return false;
  if (rollAngle !== undefined && Math.abs(rollAngle) > CONFIG.MAX_ROLL_ANGLE) return false;
  return true;
}

/**
 * フェーズ:
 *   idle     : 顔なし。ウェルカム表示。
 *   sampling : 顔検出中。正面を向いている間だけタイマー進行。
 *   locked   : 確定。顔が離れて IDLE_TIMEOUT_MS 経つまで値を固定。
 *
 * aligned: 顔が正面を向いているか。sampling 中に false になると
 *          バッファとタイマーをリセットして再計測を強制する。
 */
export function useAgeEstimation() {
  const estimator = useMemo(() => createEstimator(), []);
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

  const onFaceDetected = useCallback(
    (face: FaceBox | null, frameWidth: number) => {
      if (!face) {
        scheduleIdleReset();
        return;
      }
      const ratio = face.width / Math.max(frameWidth, 1);
      if (ratio < CONFIG.MIN_FACE_RATIO) {
        scheduleIdleReset();
        return;
      }
      clearIdleTimer();

      const aligned = isFaceAligned(face);

      setState((prev) => {
        // 確定済みなら face 位置だけ更新
        if (prev.phase === 'locked') {
          return prev.face === face ? prev : { ...prev, face };
        }

        // 顔が正面を向いていない → バッファ・タイマーをリセット、ヒント表示
        if (!aligned) {
          bufferRef.current.clear();
          samplingStartedAtRef.current = null;
          return { ...INITIAL_STATE, face, phase: 'sampling', aligned: false, progress: 0 };
        }

        const estimate = estimator.estimate(face, frameWidth);
        if (!estimate) return prev;

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
            face,
            estimate,
            smoothedAge,
            decision: decideGate(smoothedAge, bufferRef.current.size()),
            phase: 'locked',
            progress: 1,
            lockedAge: smoothedAge,
            aligned: true,
          };
        }

        return {
          face,
          estimate,
          smoothedAge,
          decision: 'idle',
          phase: 'sampling',
          progress,
          lockedAge: null,
          aligned: true,
        };
      });
    },
    [clearIdleTimer, estimator, scheduleIdleReset],
  );

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer]);

  return { state, onFaceDetected };
}
