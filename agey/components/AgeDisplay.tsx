import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { KioskPhase, SamplingHint } from '@/types/agey';

type Props = {
  age: number | null;
  phase: KioskPhase;
  progress: number;
  samplingHint: SamplingHint;
};

const HINT_TEXT: Record<NonNullable<SamplingHint>, { main: string; sub: string }> = {
  tooFar:     { main: 'もう少し近づいてください', sub: 'カメラに顔を近づけると測定が始まります' },
  tooClose:   { main: '少し離れてください',       sub: 'カメラから少し距離を取ってください' },
  misaligned: { main: 'まっすぐ向けてください',   sub: '顔を正面カメラに向けると測定が始まります' },
};

export function AgeDisplay({ age, phase, progress, samplingHint }: Props) {
  if (phase === 'idle' || (phase === 'sampling' && age === null && samplingHint === null)) {
    return (
      <View className="items-center">
        <Text className="text-xl text-white/60">顔をカメラに向けてください</Text>
      </View>
    );
  }

  if (phase === 'sampling') {
    if (samplingHint !== null) {
      const { main, sub } = HINT_TEXT[samplingHint];
      return (
        <View className="items-center">
          <Text className="text-2xl font-semibold text-yellow-400">{main}</Text>
          <Text className="mt-1 text-sm text-white/50">{sub}</Text>
        </View>
      );
    }

    return (
      <View className="items-center">
        <View className="relative h-28 w-28 items-center justify-center">
          <ProgressRing progress={progress} size={112} />
          <Text className="absolute text-lg text-white/70">解析準備中</Text>
        </View>
        <Text className="mt-3 text-base text-white/60">静止してください...</Text>
      </View>
    );
  }

  if (phase === 'analyzing') {
    return (
      <View className="items-center gap-3">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-xl text-white/70">年齢を解析中...</Text>
      </View>
    );
  }

  // locked
  if (age === null) return null;
  return <LockedDisplay baseAge={Math.round(age)} />;
}

function LockedDisplay({ baseAge }: { baseAge: number }) {
  const [displayAge, setDisplayAge] = useState(baseAge);

  useEffect(() => {
    setDisplayAge(baseAge);
    const id = setInterval(() => {
      const drift = Math.round((Math.random() - 0.5) * 4);
      setDisplayAge(Math.max(baseAge - 2, Math.min(baseAge + 2, baseAge + drift)));
    }, 400);
    return () => clearInterval(id);
  }, [baseAge]);

  return (
    <View className="items-center">
      <Text className="text-xl text-white/70">推定年齢</Text>
      <View className="mt-2 flex-row items-end">
        <Text className="text-[144px] font-bold leading-none text-white">{displayAge}</Text>
        <Text className="mb-6 ml-2 text-4xl text-white/80">歳</Text>
      </View>
    </View>
  );
}

function ProgressRing({ progress, size }: { progress: number; size: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} fill="transparent" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#ffffff" strokeWidth={stroke} fill="transparent"
        strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}
