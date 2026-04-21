import { useEffect, useMemo } from 'react';
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

type Props = {
  onFace: (face: FaceBox | null, frameWidth: number, frameHeight: number) => void;
  onLayout?: (size: { width: number; height: number }) => void;
  style?: { width: number; height: number };
};

/**
 * フロントカメラでプレビュー + ML Kit 顔検出フレームプロセッサを動かす。
 * 最大の顔を 1 件だけ上位に伝える (キオスク想定: 画面を覗く人は通常 1 人)。
 */
export function KioskCamera({ onFace, onLayout, style }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

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
      // 最大顔のみ採用
      let best = faces[0];
      if (!best) {
        reportFace(null, frame.width, frame.height);
        return;
      }
      for (const f of faces) {
        const areaBest = best.bounds.width * best.bounds.height;
        const area = f.bounds.width * f.bounds.height;
        if (area > areaBest) best = f;
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
        style={{ flex: 1 }}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        fps={CONFIG.FRAME_PROCESSOR_FPS}
        photo={false}
        video={false}
        audio={false}
      />
    </View>
  );
}
