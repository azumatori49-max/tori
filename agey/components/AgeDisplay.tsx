import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { KioskPhase } from '@/types/agey';

type Props = {
  age: number | null;
  phase: KioskPhase;
  progress: number;
};

export function AgeDisplay({ age, phase, progress }: Props) {
  if (phase === 'idle' || age === null) {
    return (
      <View className="items-center">
        <Text className="text-xl text-white/60">顔をカメラに向けてください</Text>
      </View>
    );
  }

  if (phase === 'sampling') {
    return (
      <View className="items-center">
        <View className="relative h-28 w-28 items-center justify-center">
          <ProgressRing progress={progress} size={112} />
          <View className="absolute items-center">
            <Text className="text-4xl font-bold text-white/80">{Math.round(age)}</Text>
          </View>
        </View>
        <Text className="mt-3 text-base text-white/60">測定中...</Text>
      </View>
    );
  }

  return <LockedDisplay baseAge={Math.round(age)} />;
}

/** 確定後: ベース年齢から ±2 でゆっくり揺れる */
function LockedDisplay({ baseAge }: { baseAge: number }) {
  const [displayAge, setDisplayAge] = useState(baseAge);

  useEffect(() => {
    setDisplayAge(baseAge);
    const id = setInterval(() => {
      const drift = Math.round((Math.random() - 0.5) * 4); // -2 〜 +2
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
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={stroke}
        fill="transparent"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#ffffff"
        strokeWidth={stroke}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
