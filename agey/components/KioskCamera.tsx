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
    landmarkMode: 'none',
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

      // Run TFLite age inference in worklet when model is loaded
      let estimatedAge: number | null = null;
      const model = tflite.model;
      if (!CONFIG.DEV_MOCK_ESTIMATOR && model != null) {
        try {
          const S = CONFIG.MODEL_INPUT_SIZE;
          const pad = CONFIG.MODEL_FACE_PADDING;

          // Face bounding box with padding, clamped to frame
          const fx = Math.max(0, Math.floor(best.bounds.x - best.bounds.width * pad));
          const fy = Math.max(0, Math.floor(best.bounds.y - best.bounds.height * pad));
          const fw = Math.min(frame.width - fx, Math.ceil(best.bounds.width * (1 + pad * 2)));
          const fh = Math.min(frame.height - fy, Math.ceil(best.bounds.height * (1 + pad * 2)));

          // Raw RGB pixels: 3 bytes per pixel (R, G, B)
          // Requires pixelFormat='rgb' on the Camera component
          const buffer = frame.toArrayBuffer();
          const bytes = new Uint8Array(buffer);

          // Crop + nearest-neighbour resize to S×S, normalize to [0, 1]
          const input = new Float32Array(S * S * 3);
          for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
              const srcX = fx + Math.floor((x * fw) / S);
              const srcY = fy + Math.floor((y * fh) / S);
              const srcIdx = (srcY * frame.width + srcX) * 3;
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
          // Inference error — estimatedAge stays null, mock fallback used upstream
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
        // rgb gives consistent 3-byte pixels needed for face crop extraction
        pixelFormat={CONFIG.DEV_MOCK_ESTIMATOR ? 'native' : 'rgb'}
        photo={false}
        video={false}
        audio={false}
      />
    </View>
  );
}
