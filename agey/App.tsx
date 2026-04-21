import './global.css';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AgeDisplay } from '@/components/AgeDisplay';
import { FaceFrameOverlay } from '@/components/FaceFrameOverlay';
import { GateBanner } from '@/components/GateBanner';
import { KioskCamera } from '@/components/KioskCamera';
import { PrivacyNote } from '@/components/PrivacyNote';
import { useAgeEstimation } from '@/hooks/useAgeEstimation';
import type { FaceBox } from '@/types/agey';

export default function App() {
  const { state, onFaceDetected } = useAgeEstimation();
  const [frameSize, setFrameSize] = useState({ width: 1, height: 1 });
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

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

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-neutral-950" edges={['top', 'bottom']}>
        <View className="flex-1 px-6 pb-6 pt-4">
          <View className="mb-4 items-center">
            <Text className="text-3xl font-bold tracking-widest text-white">エイジー</Text>
            <Text className="mt-1 text-xs text-white/50">AGE CHECK KIOSK</Text>
          </View>

          <View className="relative items-center justify-center">
            <KioskCamera
              onFace={handleFace}
              onLayout={setPreviewSize}
              style={{ width: 320, height: 420 }}
            />
            <FaceFrameOverlay
              face={state.face}
              containerWidth={previewSize.width}
              containerHeight={previewSize.height}
              frameWidth={frameSize.width}
              frameHeight={frameSize.height}
              color={overlayColor}
            />
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
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
