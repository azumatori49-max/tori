import './global.css';
import { useCallback, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AgeDisplay } from '@/components/AgeDisplay';
import { FaceFrameOverlay } from '@/components/FaceFrameOverlay';
import { GateBanner } from '@/components/GateBanner';
import { KioskCamera } from '@/components/KioskCamera';
import { PrivacyNote } from '@/components/PrivacyNote';
import { useAgeEstimation } from '@/hooks/useAgeEstimation';
import type { FaceBox } from '@/types/agey';

const CAMERA_ASPECT = 320 / 420; // width / height

function KioskLayout() {
  const { state, onFaceDetected } = useAgeEstimation();
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = screenW > screenH;

  const handleFace = useCallback(
    (face: FaceBox | null, frameWidth: number, frameHeight: number) => {
      setFrameSize((prev) =>
        prev.width === frameWidth && prev.height === frameHeight
          ? prev
          : { width: frameWidth, height: frameHeight },
      );
      onFaceDetected(face, frameWidth);
    },
    [onFaceDetected],
  );

  const overlayColor =
    state.phase === 'locked'
      ? state.decision === 'pass' ? '#22c55e' : '#ef4444'
      : state.samplingHint !== null ? '#facc15'
      : '#ffffff80';

  // Camera dimensions adapt to orientation
  let cameraWidth: number;
  let cameraHeight: number;
  if (isLandscape) {
    const availH = screenH - insets.top - insets.bottom - 24;
    cameraHeight = Math.min(availH, screenH * 0.88);
    cameraWidth = Math.round(cameraHeight * CAMERA_ASPECT);
  } else {
    cameraWidth = Math.min(320, screenW - 48);
    cameraHeight = Math.round(cameraWidth / CAMERA_ASPECT);
  }

  const camera = (
    <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      <KioskCamera
        onFace={handleFace}
        onLayout={setPreviewSize}
        style={{ width: cameraWidth, height: cameraHeight }}
      />
      <FaceFrameOverlay
        face={state.face}
        containerWidth={previewSize.width}
        containerHeight={previewSize.height}
        frameWidth={frameSize.width}
        frameHeight={frameSize.height}
        color={overlayColor}
        samplingHint={state.samplingHint}
      />
    </View>
  );

  if (isLandscape) {
    // Camera left, info right
    return (
      <SafeAreaView className="flex-1 bg-neutral-950" edges={['top', 'bottom', 'left', 'right']}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 24 }}>
          {camera}
          <View style={{ flex: 1, gap: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Text className="text-3xl font-bold tracking-widest text-white">エイジー</Text>
              <Text className="mt-1 text-xs text-white/50">AGE CHECK KIOSK</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <AgeDisplay
                age={state.phase === 'locked' ? state.lockedAge : state.smoothedAge}
                phase={state.phase}
                progress={state.progress}
                samplingHint={state.samplingHint}
              />
            </View>
            <View style={{ marginTop: 'auto', gap: 12 }}>
              <GateBanner decision={state.decision} phase={state.phase} />
              <PrivacyNote />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Portrait: title → camera → age → gate/privacy
  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pb-6 pt-4">
        <View className="mb-4 items-center">
          <Text className="text-3xl font-bold tracking-widest text-white">エイジー</Text>
          <Text className="mt-1 text-xs text-white/50">AGE CHECK KIOSK</Text>
        </View>
        <View className="items-center justify-center">
          {camera}
        </View>
        <View className="mt-8 items-center">
          <AgeDisplay
            age={state.phase === 'locked' ? state.lockedAge : state.smoothedAge}
            phase={state.phase}
            progress={state.progress}
            samplingHint={state.samplingHint}
          />
        </View>
        <View className="mt-auto gap-3">
          <GateBanner decision={state.decision} phase={state.phase} />
          <PrivacyNote />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <KioskLayout />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
