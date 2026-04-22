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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_ASSET = require('../assets/models/age_model.tflite') as number;

// InsightFace genderage 96×96 reference eye positions (from 112×112 template × 96/112)
const TGT_LX = 32.82, TGT_LY = 44.31; // person's left  eye in aligned crop
const TGT_RX = 63.03, TGT_RY = 44.14; // person's right eye in aligned crop

export function KioskCamera({ onFace, onLayout, style }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  const tflite = useTensorflowModel(MODEL_ASSET);

  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
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
          const S = CONFIG.MODEL_INPUT_SIZE; // 96
          const fw = frame.width;
          const fh = frame.height;

          const buffer = frame.toArrayBuffer();
          const bytes = new Uint8Array(buffer);
          const input = new Float32Array(S * S * 3);

          const le = best.landmarks?.LEFT_EYE;
          const re = best.landmarks?.RIGHT_EYE;

          if (le && re) {
            // ---- 2-point similarity transform (InsightFace-style alignment) ----
            // Find M such that: M * source_eye = target_eye
            //   forward:  crop_pt = a*frame_x - b*frame_y + c
            //                       b*frame_x + a*frame_y + d
            // We solve for (a, b, c, d) using two point correspondences.

            const ds_x = re.x - le.x; // source right-left vector
            const ds_y = re.y - le.y;
            const denom = ds_x * ds_x + ds_y * ds_y;

            if (denom > 4) { // guards against degenerate (faces too small / eyes same pos)
              const dt_x = TGT_RX - TGT_LX;
              const dt_y = TGT_RY - TGT_LY;

              // Complex division: (dt) / (ds)  →  a + ib
              const a  = (dt_x * ds_x + dt_y * ds_y) / denom;
              const b  = (dt_y * ds_x - dt_x * ds_y) / denom;
              const c  = TGT_LX - a * le.x + b * le.y;
              const dv = TGT_LY - b * le.x - a * le.y;

              // Inverse transform (crop → frame):
              //   [[a,-b],[b,a]]^-1 = [[a,b],[-b,a]] / (a²+b²)
              const det = a * a + b * b;
              const ia = a / det;
              const ib = b / det;

              for (let py = 0; py < S; py++) {
                for (let px = 0; px < S; px++) {
                  const ex = px - c;
                  const ey = py - dv;
                  const fx = Math.round(ia * ex + ib * ey);
                  const fy = Math.round(-ib * ex + ia * ey);
                  const si = Math.max(0, Math.min(fw - 1, fx));
                  const sj = Math.max(0, Math.min(fh - 1, fy));
                  const srcIdx = (sj * fw + si) * 3;
                  const dstIdx = (py * S + px) * 3;
                  input[dstIdx]     = (bytes[srcIdx]     ?? 0) / 255;
                  input[dstIdx + 1] = (bytes[srcIdx + 1] ?? 0) / 255;
                  input[dstIdx + 2] = (bytes[srcIdx + 2] ?? 0) / 255;
                }
              }
            } else {
              // landmark denom too small — fall through to bbox crop below
              le.x = 0; // mark le as invalid so we fall to bbox path
            }
          }

          // Fallback: bbox-based crop (when no landmarks or denom too small)
          if (!le || !re) {
            const pad = CONFIG.MODEL_FACE_PADDING;
            const bx = Math.max(0, Math.floor(best.bounds.x - best.bounds.width * pad));
            const by = Math.max(0, Math.floor(best.bounds.y - best.bounds.height * pad));
            const bw = Math.min(fw - bx, Math.ceil(best.bounds.width * (1 + pad * 2)));
            const bh = Math.min(fh - by, Math.ceil(best.bounds.height * (1 + pad * 2)));

            for (let y = 0; y < S; y++) {
              for (let x = 0; x < S; x++) {
                const srcX = bx + Math.floor((x * bw) / S);
                const srcY = by + Math.floor((y * bh) / S);
                const srcIdx = (srcY * fw + srcX) * 3;
                const dstIdx = (y * S + x) * 3;
                input[dstIdx]     = (bytes[srcIdx]     ?? 0) / 255;
                input[dstIdx + 1] = (bytes[srcIdx + 1] ?? 0) / 255;
                input[dstIdx + 2] = (bytes[srcIdx + 2] ?? 0) / 255;
              }
            }
          }

          const result = model.runSync([input]);
          const ageNorm = result[0]?.[CONFIG.MODEL_AGE_OUTPUT_IDX];
          if (ageNorm != null) {
            estimatedAge = Math.max(1, Math.min(120, ageNorm * CONFIG.MODEL_AGE_SCALE));
          }
        } catch {
          // inference error — mock fallback used upstream
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
