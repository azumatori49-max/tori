import React from 'react';
import { View, Text, Pressable } from 'react-native';

type Props = {
  message: string;
  onReset: () => void;
};

export function ErrorOverlay({ message, onReset }: Props) {
  return (
    <View className="absolute inset-0 items-center justify-center bg-red-900/95 p-8">
      <Text className="text-[72px] mb-4">⚠️</Text>
      <Text className="text-white text-2xl font-bold text-center mb-4">エラー</Text>
      <Text className="text-white/80 text-base text-center">{message}</Text>
      <Pressable
        onPress={onReset}
        className="mt-10 bg-white px-10 py-4 rounded-full active:opacity-80"
      >
        <Text className="text-black font-bold text-lg">もう一度</Text>
      </Pressable>
    </View>
  );
}
