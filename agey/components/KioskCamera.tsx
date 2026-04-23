import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import { CONFIG } from '@/constants/config';
import type { FaceBox } from '@/types/agey';

export type KioskCameraHandle = {
  takePhoto: () => Promise<string | null>;
};

type Props = {
  onFace: (face: FaceBox | null, frameWidth: number, frameHeight: number) => void;
  onLayout?: (size: { width: number; height: number }) => void;
  style?: { width: number; height: number };
};

export const KioskCamera = forwardRef<KioskCameraHandle, Props>(function KioskCamera(
  { onFace, onLayout, style },
  ref,
) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  useImperativeHandle(ref, () => ({
    async takePhoto() {
      try {
        const photo = await cameraRef.current?.takePhoto({ qualityPrioritization: 'balanced' });
        return photo?.path ?? null;
      } catch {
        return null;
      }
    },
  }));

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
        reportFace(null, frame.width, frame.height);
        return;
      }
      let best = faces[0];
      if (!best) {
        reportFace(null, frame.width, frame.height);
        return;
      }
      for (const f of faces) {
        if (f.bounds.width * f.bounds.height > best.bounds.width * best.bounds.height) best = f;
      }
      reportFace(
        {
          x: best.bounds.x,
          y: best.bounds.y,
          width: best.bounds.width,
          height: best.bounds.height,
          yawAngle: best.yawAngle,
          pitchAngle: best.pitchAngle,
          rollAngle: best.rollAngle,
        },
        frame.width,
        frame.height,
      );
    },
    [detectFaces, reportFace],
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
        ref={cameraRef}
        style={{ flex: 1 }}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        fps={CONFIG.FRAME_PROCESSOR_FPS}
        pixelFormat="native"
        photo={true}
        video={false}
        audio={false}
      />
    </View>
  );
});
