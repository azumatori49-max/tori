import './global.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, AppState } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FaceFrame } from './components/FaceFrame';
import { ResultOverlay } from './components/ResultOverlay';
import { ErrorOverlay } from './components/ErrorOverlay';
import { detectFaces, type FaceAnalysis } from './lib/rekognition';
import {
  CHECK_INTERVAL_MS,
  MIN_FACE_CONFIDENCE,
  MIN_FACE_SIZE_RATIO,
} from './constants/config';

type Mode = 'scanning' | 'result' | 'error';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [mode, setMode] = useState<Mode>('scanning');
  const [result, setResult] = useState<FaceAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [hint, setHint] = useState('枠に顔を合わせてください');
  const cameraRef = useRef<CameraView | null>(null);
  const busyRef = useRef(false);
  const modeRef = useRef<Mode>('scanning');

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const captureAndAnalyze = useCallback(async () => {
    if (busyRef.current) return;
    if (modeRef.current !== 'scanning') return;
    if (!cameraRef.current || !cameraReady) return;
    busyRef.current = true;
    try {
      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: false,
        shutterSound: false,
        skipProcessing: true,
      });
      if (!shot?.uri) return;
      const resized = await manipulateAsync(
        shot.uri,
        [{ resize: { width: 480 } }],
        { base64: true, compress: 0.7, format: SaveFormat.JPEG },
      );
      if (!resized.base64) return;
      if (modeRef.current !== 'scanning') return;

      const face = await detectFaces(resized.base64);
      if (modeRef.current !== 'scanning') return;

      if (!face) {
        setHint('顔が検出できません。枠に顔を合わせてください');
        return;
      }
      if (face.faceCount > 1) {
        setHint('1人ずつお願いします');
        return;
      }
      if (face.confidence < MIN_FACE_CONFIDENCE) {
        setHint('もう一度、正面を向いてください');
        return;
      }
      const faceSize = Math.max(face.boundingBox.width, face.boundingBox.height);
      if (faceSize < MIN_FACE_SIZE_RATIO) {
        setHint('もう少し近づいてください');
        return;
      }
      setResult(face);
      setMode('result');
    } catch (e) {
      const message = e instanceof Error ? e.message : '通信エラーが発生しました';
      setErrorMsg(message);
      setMode('error');
    } finally {
      busyRef.current = false;
    }
  }, [cameraReady]);

  useEffect(() => {
    if (mode !== 'scanning' || !cameraReady) return;
    const id = setInterval(() => {
      void captureAndAnalyze();
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [mode, cameraReady, captureAndAnalyze]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        busyRef.current = false;
      }
    });
    return () => sub.remove();
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setErrorMsg('');
    setHint('枠に顔を合わせてください');
    setMode('scanning');
  }, []);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 items-center justify-center bg-black p-8">
          <StatusBar style="light" />
          <Text className="text-white text-2xl font-bold mb-4">カメラの許可が必要です</Text>
          <Text className="text-white/70 text-center mb-8">
            年齢推定のためにカメラを使用します。撮影画像は推定のみに使われ、保存されません。
          </Text>
          <Pressable
            onPress={() => void requestPermission()}
            className="bg-white px-8 py-4 rounded-full active:opacity-80"
          >
            <Text className="text-black font-bold text-lg">許可する</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-black">
        <StatusBar style="light" />
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="front"
          mute
          onCameraReady={() => setCameraReady(true)}
        />
        <FaceFrame status="scanning" />
        <SafeAreaView className="absolute top-0 left-0 right-0 items-center" edges={['top']}>
          <View className="pt-4 items-center">
            <Text className="text-white text-4xl font-bold tracking-wider">エイジー</Text>
            <Text className="text-white/60 text-sm mt-1">AGE ESTIMATION KIOSK</Text>
          </View>
        </SafeAreaView>
        {mode === 'scanning' && (
          <SafeAreaView
            className="absolute bottom-0 left-0 right-0 items-center"
            edges={['bottom']}
          >
            <View className="bg-black/70 px-6 py-3 rounded-full flex-row items-center mb-8">
              <ActivityIndicator size="small" color="#fff" />
              <Text className="text-white ml-3 text-base">{hint}</Text>
            </View>
          </SafeAreaView>
        )}
        {mode === 'result' && result && <ResultOverlay face={result} onReset={reset} />}
        {mode === 'error' && <ErrorOverlay message={errorMsg} onReset={reset} />}
      </View>
    </SafeAreaProvider>
  );
}
