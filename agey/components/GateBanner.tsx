import { Text, View } from 'react-native';
import type { GateDecision, KioskPhase } from '@/types/agey';

type Props = {
  decision: GateDecision;
  phase: KioskPhase;
};

export function GateBanner({ decision, phase }: Props) {
  if (phase === 'analyzing') {
    return (
      <View className="w-full rounded-2xl bg-white/10 px-8 py-6">
        <Text className="text-center text-2xl font-semibold text-white/70">解析中...</Text>
      </View>
    );
  }

  if (phase === 'sampling') {
    return (
      <View className="w-full rounded-2xl bg-white/10 px-8 py-6">
        <Text className="text-center text-2xl font-semibold text-white/70">測定中...</Text>
      </View>
    );
  }

  if (decision === 'idle' || phase === 'idle') {
    return (
      <View className="w-full rounded-2xl bg-white/10 px-8 py-6">
        <Text className="text-center text-2xl font-semibold text-white/70">ようこそ</Text>
      </View>
    );
  }

  if (decision === 'pass') {
    return (
      <View className="w-full rounded-2xl bg-gate-ok px-8 py-6">
        <Text className="text-center text-4xl font-bold text-white">ご入店どうぞ</Text>
        <Text className="mt-1 text-center text-base text-white/90">Welcome</Text>
      </View>
    );
  }

  return (
    <View className="w-full rounded-2xl bg-gate-ng px-8 py-6">
      <Text className="text-center text-4xl font-bold text-white">ID確認をお願いします</Text>
      <Text className="mt-1 text-center text-base text-white/90">スタッフが身分証を確認します</Text>
    </View>
  );
}
