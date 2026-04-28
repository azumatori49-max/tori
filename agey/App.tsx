import './global.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, AppState } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FaceFrame } from './components/FaceFrame';
import { ResultOverlay } from './components/ResultOverlay';
import { ErrorOverlay } from './components/ErrorOverlay';
import { estimateAgeFromImage, type FaceAnalysis } from './lib/ageEstimator';
import { warmupModels } from './lib/onnxModels';
import {
  AUTO_RESET_MS,
  CAMERA_QUALITY,
  CHECK_INTERVAL_MS,
  MAX_BRIGHTNESS,
  MIN_BRIGHTNESS,
  MIN_FACE_CONFIDENCE,
  MIN_FACE_SIZE_RATIO,
  MIN_SHARPNESS,
  SAMPLE_COUNT,
  SAMPLE_RESET_AFTER_MISSES,
  SAMPLE_TRIM,
} from './constants/config';

type Mode = 'scanning' | 'result' | 'error';

type SampleCheck =
  | { ok: true; face: FaceAnalysis }
  | { ok: false; hint: string };

// 撮影品質ゲート: 推定誤差を増やす条件を弾く。
// オンデバイス ONNX に切り替えたためポーズ推定は外している
// （genderage モデルではポーズが取得できない）。
// シャープネスも未実装のため当面は固定値 80 を返す ageEstimator 側の挙動に依存する。
function checkSampleQuality(face: FaceAnalysis | null): SampleCheck {
  if (!face) return { ok: false, hint: '枠に顔を合わせてください' };
  if (face.confidence < MIN_FACE_CONFIDENCE) {
    return { ok: false, hint: 'マスク・帽子を外してください' };
  }
  const faceSize = Math.max(face.boundingBox.width, face.boundingBox.height);
  if (faceSize < MIN_FACE_SIZE_RATIO) {
    return { ok: false, hint: 'もう少し近づいてください' };
  }
  if (face.qualityBrightness < MIN_BRIGHTNESS) {
    return { ok: false, hint: '明るい場所でお試しください' };
  }
  if (face.qualityBrightness > MAX_BRIGHTNESS) {
    return { ok: false, hint: '逆光を避けてください' };
  }
  if (face.qualitySharpness < MIN_SHARPNESS) {
    return { ok: false, hint: '動かずに静止してください' };
  }
  return { ok: true, face };
}

// Sharpness 重み付きトリム平均: 上下 SAMPLE_TRIM 個を除外し、残ったサンプルを
// Rekognition の Quality.Sharpness で重み付けして平均する。
function weightedTrimmedMean(
  samples: FaceAnalysis[],
  pickValue: (s: FaceAnalysis) => number,
): number {
  const sorted = [...samples].sort((a, b) => pickValue(a) - pickValue(b));
  const middle = sorted.slice(SAMPLE_TRIM, sorted.length - SAMPLE_TRIM);
  if (middle.length === 0) {
    return Math.round(pickValue(sorted[Math.floor(sorted.length / 2)]!));
  }
  let totalWeight = 0;
  let weightedSum = 0;
  for (const s of middle) {
    const weight = Math.max(s.qualitySharpness, 1);
    totalWeight += weight;
    weightedSum += pickValue(s) * weight;
  }
  return Math.round(weightedSum / totalWeight);
}

function aggregateSamples(samples: FaceAnalysis[]): FaceAnalysis {
  const ageLow = weightedTrimmedMean(samples, (s) => s.ageLow);
  const ageHigh = weightedTrimmedMean(samples, (s) => s.ageHigh);
  const latest = samples[samples.length - 1]!;
  return { ...latest, ageLow, ageHigh };
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [mode, setMode] = useState<Mode>('scanning');
  const [result, setResult] = useState<FaceAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [hint, setHint] = useState('枠に顔を合わせてください');
  const [sampleProgress, setSampleProgress] = useState(0);
  const cameraRef = useRef<CameraView | null>(null);
  const capturingRef = useRef(false);
  const inFlightRef = useRef(0);
  const modeRef = useRef<Mode>('scanning');
  const samplesRef = useRef<FaceAnalysis[]>([]);
  const missCountRef = useRef(0);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // ONNX モデルを起動時にロードしておく。最初のスキャン時のレイテンシを短縮する。
  useEffect(() => {
    void warmupModels().catch((e: unknown) => {
      console.warn('[App] モデルロード失敗:', e);
    });
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (modeRef.current !== 'scanning') return;
    if (!cameraRef.current || !cameraReady) return;
    if (capturingRef.current) return;
    if (samplesRef.current.length + inFlightRef.current >= SAMPLE_COUNT) return;

    capturingRef.current = true;
    let shotUri: string | null = null;
    try {
      const shot = await cameraRef.current.takePictureAsync({
        quality: CAMERA_QUALITY,
        base64: false,
        shutterSound: false,
        skipProcessing: true,
      });
      shotUri = shot?.uri ?? null;
    } catch (e) {
      capturingRef.current = false;
      const message = e instanceof Error ? e.message : '撮影エラーが発生しました';
      setErrorMsg(message);
      setMode('error');
      return;
    }
    capturingRef.current = false;
    if (!shotUri) return;

    inFlightRef.current += 1;
    try {
      if (modeRef.current !== 'scanning') return;
      // CAPTURE_WIDTH へのリサイズと顔検出 + 年齢推定をオンデバイスで実行する。
      const face = await estimateAgeFromImage(shotUri);
      if (modeRef.current !== 'scanning') return;

      const check = checkSampleQuality(face);
      if (!check.ok) {
        setHint(check.hint);
        missCountRef.current += 1;
        if (missCountRef.current > SAMPLE_RESET_AFTER_MISSES) {
          samplesRef.current = [];
          setSampleProgress(0);
        }
        return;
      }

      if (samplesRef.current.length >= SAMPLE_COUNT) return;
      missCountRef.current = 0;
      samplesRef.current.push(check.face);
      const count = samplesRef.current.length;
      setSampleProgress(count);

      if (count < SAMPLE_COUNT) {
        setHint(`計測中… (${count}/${SAMPLE_COUNT})`);
        return;
      }

      const aggregated = aggregateSamples(samplesRef.current);
      samplesRef.current = [];
      setSampleProgress(0);
      setResult(aggregated);
      setMode('result');
    } catch (e) {
      const message = e instanceof Error ? e.message : '通信エラーが発生しました';
      setErrorMsg(message);
      setMode('error');
    } finally {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
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
        capturingRef.current = false;
        inFlightRef.current = 0;
      }
    });
    return () => sub.remove();
  }, []);

  const reset = useCallback(() => {
    samplesRef.current = [];
    missCountRef.current = 0;
    inFlightRef.current = 0;
    capturingRef.current = false;
    setSampleProgress(0);
    setResult(null);
    setErrorMsg('');
    setHint('枠に顔を合わせてください');
    setMode('scanning');
  }, []);

  // 入口キオスクは客が画面に触らない前提のため、結果表示後は自動でスキャン画面へ戻す。
  useEffect(() => {
    if (mode === 'scanning') return;
    const id = setTimeout(() => reset(), AUTO_RESET_MS);
    return () => clearTimeout(id);
  }, [mode, reset]);

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
            {sampleProgress > 0 && sampleProgress < SAMPLE_COUNT && (
              <View className="flex-row mb-4">
                {Array.from({ length: SAMPLE_COUNT }).map((_, i) => (
                  <View
                    key={i}
                    className={`w-3 h-3 rounded-full mx-1 ${
                      i < sampleProgress ? 'bg-emerald-400' : 'bg-white/30'
                    }`}
                  />
                ))}
              </View>
            )}
          </SafeAreaView>
        )}
        {mode === 'result' && result && <ResultOverlay face={result} onReset={reset} />}
        {mode === 'error' && <ErrorOverlay message={errorMsg} onReset={reset} />}
      </View>
    </SafeAreaProvider>
  );
}
