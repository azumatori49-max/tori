import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from '@/constants/config';
import { AgeBuffer } from '@/lib/ageBuffer';
import { createEstimator } from '@/lib/ageEstimator';
import { decideGate } from '@/lib/decision';
import type { FaceBox, KioskState } from '@/types/agey';

/**
 * 顔検出結果を受け取り、年齢推定 → 平滑化 → 判定 までを束ねるフック。
 * VisionCamera のフレームプロセッサから `onFaceDetected` に矩形を渡す想定。
 */
export function useAgeEstimation() {
  const estimator = useMemo(() => createEstimator(), []);
  const bufferRef = useRef(new AgeBuffer(CONFIG.SMOOTHING_WINDOW));
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<KioskState>({
    face: null,
    estimate: null,
    smoothedAge: null,
    decision: 'idle',
  });

  const resetToIdle = useCallback(() => {
    bufferRef.current.clear();
    setState({ face: null, estimate: null, smoothedAge: null, decision: 'idle' });
  }, []);

  const scheduleIdleReset = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(resetToIdle, CONFIG.IDLE_TIMEOUT_MS);
  }, [resetToIdle]);

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
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }

      const estimate = estimator.estimate(face, frameWidth);
      if (!estimate) return;

      bufferRef.current.push(estimate);
      const smoothedAge = bufferRef.current.median();
      const decision = decideGate(smoothedAge, bufferRef.current.size());

      setState({ face, estimate, smoothedAge, decision });
    },
    [estimator, scheduleIdleReset],
  );

  useEffect(
    () => () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    },
    [],
  );

  return { state, onFaceDetected };
}
