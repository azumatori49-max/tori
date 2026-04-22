import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { Worklets } from 'react-native-worklets-core';
import { CONFIG } from '@/constants/config';
import type { FaceBox } from '@/types/agey';

type Props = {
  onFace: (face: FaceBox | null, estimatedAge: number | null, frameWidth: number, frameHeight: number) => void;
  onLayout?: (size: { width: number; height: number }) => void;
  style?: { width: number; height: number };
};

// Run scripts/prepare_model.py to regenerate if this file is missing.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_ASSET = require('../assets/models/age_model.tflite') as number;

export function KioskCamera({ onFace, onLayout, style }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const tflite = useTensorflowModel(MODEL_ASSET);

  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    // All landmarks needed for eye-based rotation correction
    landmarkMode: CONFIG.DEV_MOCK_ESTIMATOR ? 'none' : 'all',
    contourMode: 'none',
    classificationMode: 'none',
    minFaceSize: 0.05,
    trackingEnabled: false,
  });

  const reportFace = useMemo(() => Worklets.createRunOnJS(onFace), [onFace]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      const faces = detectFaces(frame);
      if (!faces || faces.length === 0) {
        reportFace(null, null, frame.width, frame.height);
        return;
      }

      let best = faces[0];
      if (!best) {
        reportFace(null, null, frame.width, frame.height);
        return;
      }
      for (const f of faces) {
        if (f.bounds.width * f.bounds.height > best.bounds.width * best.bounds.height) {
          best = f;
        }
      }

      const faceBox: FaceBox = {
        x: best.bounds.x,
        y: best.bounds.y,
        width: best.bounds.width,
        height: best.bounds.height,
        yawAngle: best.yawAngle,
        pitchAngle: best.pitchAngle,
        rollAngle: best.rollAngle,
      };

      let estimatedAge: number | null = null;
      const model = tflite.model;
      if (!CONFIG.DEV_MOCK_ESTIMATOR && model != null) {
        try {
          const S = CONFIG.MODEL_INPUT_SIZE;

          // --- Compute aligned crop center, size, and roll angle ---
          // Default: use bounding box center with padding
          let cx = best.bounds.x + best.bounds.width / 2;
          let cy = best.bounds.y + best.bounds.height / 2;
          let cropSize = Math.max(best.bounds.width, best.bounds.height) * (1 + CONFIG.MODEL_FACE_PADDING * 2);
          let rollAngle = 0;

          const le = best.landmarks?.LEFT_EYE;
          const re = best.landmarks?.RIGHT_EYE;
          if (le && re) {
            // Eye midpoint as crop center (more stable than bbox center)
            cx = (le.x + re.x) / 2;
            cy = (le.y + re.y) / 2;
            // Roll angle between eyes → rotate input to align eyes horizontally
            rollAngle = Math.atan2(re.y - le.y, re.x - le.x);
            // Crop size from inter-eye distance: empirically ~2.7× gives a tight face crop
            const eyeDist = Math.sqrt((re.x - le.x) ** 2 + (re.y - le.y) ** 2);
            cropSize = eyeDist * 3.5;
          }

          const cosA = Math.cos(-rollAngle);
          const sinA = Math.sin(-rollAngle);

          const buffer = frame.toArrayBuffer();
          const bytes = new Uint8Array(buffer);
          const fw = frame.width;
          const fh = frame.height;

          // Build S×S input with rotation-corrected sampling
          const input = new Float32Array(S * S * 3);
          for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
              // Normalised position in crop space [-0.5, 0.5]
              const nx = x / S - 0.5;
              const ny = y / S - 0.5;
              // Rotate and map back to frame coordinates
              const srcX = Math.round(cx + (nx * cosA - ny * sinA) * cropSize);
              const srcY = Math.round(cy + (nx * sinA + ny * cosA) * cropSize);

              const si = Math.max(0, Math.min(fw - 1, srcX));
              const sj = Math.max(0, Math.min(fh - 1, srcY));
              const srcIdx = (sj * fw + si) * 3;
              const dstIdx = (y * S + x) * 3;
              input[dstIdx]     = (bytes[srcIdx]     ?? 0) / 255;
              input[dstIdx + 1] = (bytes[srcIdx + 1] ?? 0) / 255;
              input[dstIdx + 2] = (bytes[srcIdx + 2] ?? 0) / 255;
            }
          }

          const result = model.runSync([input]);
          const ageNorm = result[0]?.[CONFIG.MODEL_AGE_OUTPUT_IDX];
          if (ageNorm != null) {
            estimatedAge = Math.max(1, Math.min(120, ageNorm * CONFIG.MODEL_AGE_SCALE));
          }
        } catch {
          // Inference error — fall back to mock upstream
        }
      }

      reportFace(faceBox, estimatedAge, frame.width, frame.height);
    },
    [detectFaces, reportFace, tflite],
  );

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">カメラの許可が必要です</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">フロントカメラが見つかりません</Text>
      </View>
    );
  }

  return (
    <View
      className="overflow-hidden rounded-3xl bg-black"
      style={style}
      onLayout={(e) => {
        onLayout?.({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        });
      }}
    >
      <Camera
        style={{ flex: 1 }}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        fps={CONFIG.FRAME_PROCESSOR_FPS}
        pixelFormat={CONFIG.DEV_MOCK_ESTIMATOR ? 'native' : 'rgb'}
        photo={false}
        video={false}
        audio={false}
      />
    </View>
  );
}
