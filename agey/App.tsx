import './global.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, AppState } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FaceFrame } from './components/FaceFrame';
import { ResultOverlay, getVerdict } from './components/ResultOverlay';
import { ErrorOverlay } from './components/ErrorOverlay';
import { IdInputModal } from './components/IdInputModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';
import { detectFaces, type FaceAnalysis } from './lib/rekognition';
import { logCalibration } from './lib/calibrationLog';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type AdminSettings,
} from './lib/settings';
import {
  AUTO_RESET_MS,
  CAMERA_QUALITY,
  CAPTURE_WIDTH,
  CHECK_INTERVAL_MS,
  JPEG_QUALITY,
  MAX_BRIGHTNESS,
  MAX_POSE_PITCH,
  MAX_POSE_ROLL,
  MAX_POSE_YAW,
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
// 弾いた理由を画面のヒントに反映してユーザを誘導する。
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
  if (Math.abs(face.pose.yaw) > MAX_POSE_YAW) {
    return { ok: false, hint: '正面を向いてください' };
  }
  if (Math.abs(face.pose.pitch) > MAX_POSE_PITCH) {
    return { ok: false, hint: '顔を真っ直ぐにしてください' };
  }
  if (Math.abs(face.pose.roll) > MAX_POSE_ROLL) {
    return { ok: false, hint: '顔を真っ直ぐにしてください' };
  }
  return { ok: true, face };
}

// Sharpness 重み付きトリム平均: 上下 SAMPLE_TRIM 個を除外し、残ったサンプルを
// Rekognition の Quality.Sharpness で重み付けして平均する。鮮明な画像ほど推定の
// 信頼度が高いため、重みを乗せることで外れ値の影響をさらに抑える。
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
    // 重み 0 を防ぐためフロアを 1 に設定。
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
  const [logging, setLogging] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const cameraRef = useRef<CameraView | null>(null);
  const busyRef = useRef(false);
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

  // 端末に保存された管理者設定を起動時に読み込む。
  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (busyRef.current) return;
    if (modeRef.current !== 'scanning') return;
    if (!cameraRef.current || !cameraReady) return;
    busyRef.current = true;
    try {
      const shot = await cameraRef.current.takePictureAsync({
        quality: CAMERA_QUALITY,
        base64: false,
        shutterSound: false,
        skipProcessing: true,
      });
      if (!shot?.uri) return;
      const resized = await manipulateAsync(
        shot.uri,
        [{ resize: { width: CAPTURE_WIDTH } }],
        { base64: true, compress: JPEG_QUALITY, format: SaveFormat.JPEG },
      );
      if (!resized.base64) return;
      if (modeRef.current !== 'scanning') return;

      const face = await detectFaces(resized.base64);
      if (modeRef.current !== 'scanning') return;

      const check = checkSampleQuality(face);
      if (!check.ok) {
        setHint(check.hint);
        missCountRef.current += 1;
        // 連続で失敗したら、計測中の客が離脱したと判断してバッファをリセット。
        if (missCountRef.current > SAMPLE_RESET_AFTER_MISSES) {
          samplesRef.current = [];
          setSampleProgress(0);
        }
        return;
      }

      missCountRef.current = 0;
      samplesRef.current.push(check.face);
      setSampleProgress(samplesRef.current.length);

      if (samplesRef.current.length < SAMPLE_COUNT) {
        setHint(`計測中… (${samplesRef.current.length}/${SAMPLE_COUNT})`);
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
    samplesRef.current = [];
    missCountRef.current = 0;
    setSampleProgress(0);
    setResult(null);
    setErrorMsg('');
    setHint('枠に顔を合わせてください');
    setLogging(false);
    setMode('scanning');
  }, []);

  // 入口キオスクは客が画面に触らない前提のため、結果表示後は自動でスキャン画面へ戻す。
  // ただしスタッフが ID 入力中・管理者設定を開いている間は止める。
  useEffect(() => {
    if (mode === 'scanning') return;
    if (logging || adminOpen) return;
    const id = setTimeout(() => reset(), AUTO_RESET_MS);
    return () => clearTimeout(id);
  }, [mode, logging, adminOpen, reset]);

  const submitCalibration = useCallback(
    async (actualAge: number) => {
      if (!result) {
        setLogging(false);
        return;
      }
      await logCalibration({
        timestamp: new Date().toISOString(),
        storeId: process.env.EXPO_PUBLIC_STORE_ID ?? null,
        rekognitionLow: result.ageLow,
        rekognitionHigh: result.ageHigh,
        rekognitionMid: Math.round((result.ageLow + result.ageHigh) / 2),
        verdict: getVerdict(result, settings),
        actualAge,
        faceCount: result.faceCount,
        qualityBrightness: result.qualityBrightness,
        qualitySharpness: result.qualitySharpness,
        poseYaw: result.pose.yaw,
        posePitch: result.pose.pitch,
        poseRoll: result.pose.roll,
      });
      reset();
    },
    [result, reset, settings],
  );

  const submitAdmin = useCallback(async (next: AdminSettings) => {
    setSettings(next);
    setAdminOpen(false);
    try {
      await saveSettings(next);
    } catch (e) {
      console.warn('[settings] save failed:', e);
    }
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
          {/* タイトル: 3秒長押しで管理者設定画面を開く（隠しジェスチャー） */}
          <Pressable
            onLongPress={() => setAdminOpen(true)}
            delayLongPress={3000}
            className="pt-4 items-center"
          >
            <Text className="text-white text-4xl font-bold tracking-wider">エイジー</Text>
            <Text className="text-white/60 text-sm mt-1">AGE ESTIMATION KIOSK</Text>
          </Pressable>
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
        {mode === 'result' && result && (
          <ResultOverlay
            face={result}
            settings={settings}
            onReset={reset}
            onLogId={() => setLogging(true)}
          />
        )}
        {mode === 'error' && <ErrorOverlay message={errorMsg} onReset={reset} />}
        {logging && result && (
          <IdInputModal
            face={result}
            onSubmit={submitCalibration}
            onCancel={() => setLogging(false)}
          />
        )}
        {adminOpen && (
          <AdminSettingsModal
            initial={settings}
            onSave={submitAdmin}
            onCancel={() => setAdminOpen(false)}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}
