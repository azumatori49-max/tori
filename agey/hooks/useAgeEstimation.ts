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
};

/**
 * 顔検出結果を受け取り、年齢推定 → 平滑化 → 判定 までを束ねるフック。
 *
 * フェーズ:
 *   idle     : 顔なし or 顔小さすぎ。ウェルカム表示。
 *   sampling : 顔検出中、まだ LOCK_AFTER_MS 経っていない。年齢は揺れる。
 *   locked   : 確定。顔が離れて IDLE_TIMEOUT_MS 経つまで値を固定。
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

      // 既に確定済みなら値は固定、face だけ更新してオーバーレイを追従させる
      setState((prev) => {
        if (prev.phase === 'locked') {
          return prev.face === face ? prev : { ...prev, face };
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
        };
      });
    },
    [clearIdleTimer, estimator, scheduleIdleReset],
  );

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer]);

  return { state, onFaceDetected };
}
