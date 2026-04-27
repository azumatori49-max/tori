import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FaceAnalysis } from '../lib/rekognition';

type Props = {
  face: FaceAnalysis;
  onSubmit: (actualAge: number) => void;
  onCancel: () => void;
};

// 年齢ゲート判定の境界域に近い値を上に並べ、スタッフがタップしやすくする。
const AGE_PRESETS = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 28, 30, 35, 40, 50];

export function IdInputModal({ face, onSubmit, onCancel }: Props) {
  const [ageStr, setAgeStr] = useState('');
  const ageNum = Number.parseInt(ageStr, 10);
  const isValidAge = Number.isFinite(ageNum) && ageNum >= 1 && ageNum <= 120;

  return (
    <View className="absolute inset-0 bg-black/95">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
          <Text className="text-white text-2xl font-bold mb-2">
            ID確認結果を記録
          </Text>
          <Text className="text-white/60 text-sm mb-6">
            身分証で確認した実年齢を入力してください
          </Text>

          <View className="bg-white/10 rounded-2xl p-4 mb-6">
            <Text className="text-white/60 text-xs mb-1">推定値</Text>
            <Text className="text-white text-lg font-bold">
              {face.ageLow} 〜 {face.ageHigh} 歳
            </Text>
          </View>

          <Text className="text-white/80 text-sm mb-2">実年齢</Text>
          <TextInput
            value={ageStr}
            onChangeText={(t) => setAgeStr(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="例: 18"
            placeholderTextColor="rgba(255,255,255,0.3)"
            className="bg-white/10 text-white text-3xl font-bold px-4 py-3 rounded-xl mb-4"
            maxLength={3}
            autoFocus
          />

          <Text className="text-white/60 text-xs mb-2">タップで素早く入力</Text>
          <View className="flex-row flex-wrap mb-8">
            {AGE_PRESETS.map((n) => (
              <Pressable
                key={n}
                onPress={() => setAgeStr(String(n))}
                className={`mr-2 mb-2 px-4 py-2 rounded-full ${
                  ageNum === n ? 'bg-emerald-500' : 'bg-white/10'
                }`}
              >
                <Text className="text-white font-bold">{n}</Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="flex-1 bg-white/10 px-4 py-4 rounded-full active:opacity-80"
            >
              <Text className="text-white text-center font-bold text-base">
                キャンセル
              </Text>
            </Pressable>
            <Pressable
              onPress={() => isValidAge && onSubmit(ageNum)}
              disabled={!isValidAge}
              className={`flex-1 px-4 py-4 rounded-full active:opacity-80 ${
                isValidAge ? 'bg-emerald-500' : 'bg-white/10'
              }`}
            >
              <Text
                className={`text-center font-bold text-base ${
                  isValidAge ? 'text-white' : 'text-white/40'
                }`}
              >
                記録する
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
