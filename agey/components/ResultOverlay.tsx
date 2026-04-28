import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FaceAnalysis } from '../lib/rekognition';

// 中立色 (シアン): 「これは情報提供であって判定ではない」を視覚的に伝えるため
// 信号色 (赤・黄・緑) は使わない。
const ACCENT = '#22d3ee';

type Props = {
  face: FaceAnalysis;
  onReset: () => void;
};

export function ResultOverlay({ face, onReset }: Props) {
  const ageMid = Math.round((face.ageLow + face.ageHigh) / 2);

  return (
    <Pressable onPress={onReset} className="absolute inset-0">
      {/* キオスクLEDバー（4辺） */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          backgroundColor: ACCENT,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 8,
          backgroundColor: ACCENT,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 8,
          backgroundColor: ACCENT,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 8,
          backgroundColor: ACCENT,
        }}
      />

      {/* 中央: LCDパネル風の数字表示 */}
      <View className="flex-1 items-center justify-center">
        <View
          className="bg-black/90 rounded-3xl px-12 py-8 items-center"
          style={{ borderWidth: 4, borderColor: ACCENT }}
        >
          <Text
            className="text-white/60 text-xs font-bold mb-2"
            style={{ letterSpacing: 10 }}
          >
            推定年齢
          </Text>
          <Text
            style={{
              color: ACCENT,
              fontSize: 160,
              fontWeight: '900',
              fontVariant: ['tabular-nums'],
              lineHeight: 170,
              letterSpacing: -6,
            }}
          >
            {ageMid}
          </Text>
          <Text className="text-white/70 text-base mt-1">
            ({face.ageLow} - {face.ageHigh} 歳)
          </Text>
        </View>
      </View>

      {/* 下段: シンプルな注意書きのみ */}
      <SafeAreaView edges={['bottom']} className="items-center">
        <Text className="text-white/50 text-xs mb-6 text-center px-8">
          ※ 推定値です。最終的な年齢確認は身分証で行ってください。
        </Text>
      </SafeAreaView>
    </Pressable>
  );
}
