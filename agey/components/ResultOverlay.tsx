import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ID_CHECK_THRESHOLD } from '../constants/config';
import type { FaceAnalysis } from '../lib/rekognition';

type Props = {
  face: FaceAnalysis;
  onReset: () => void;
};

export function ResultOverlay({ face, onReset }: Props) {
  const needsId = face.ageLow < ID_CHECK_THRESHOLD;
  const bgClass = needsId ? 'bg-amber-500/95' : 'bg-emerald-600/95';

  return (
    <View className={`absolute inset-0 items-center justify-center p-8 ${bgClass}`}>
      <Text className="text-[96px] leading-[100px] mb-4">{needsId ? '🪪' : '✅'}</Text>
      <Text className="text-white text-4xl font-bold text-center mb-3">
        {needsId ? '身分証のご提示を\nお願いします' : '確認不要'}
      </Text>
      <Text className="text-white/80 text-base">
        推定年齢: {face.ageLow}〜{face.ageHigh} 歳
      </Text>
      <Text className="text-white/60 text-xs mt-2">
        ※ 推定値です。法的な年齢確認ではありません。
      </Text>
      <Pressable
        onPress={onReset}
        className="mt-12 bg-white px-12 py-4 rounded-full active:opacity-80"
      >
        <Text className="text-black font-bold text-lg">次の人へ</Text>
      </Pressable>
    </View>
  );
}
