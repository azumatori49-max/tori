import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HARD_BLOCK_THRESHOLD, ID_CHECK_THRESHOLD } from '../constants/config';
import type { FaceAnalysis } from '../lib/rekognition';

export type Verdict = 'block' | 'id_check' | 'pass';

type VerdictStyle = {
  color: string;
  label: string;
  sub: string;
};

// 体温計キオスク風の配色: 彩度高めの信号色 3色
const VERDICT_STYLES: Record<Verdict, VerdictStyle> = {
  block: {
    color: '#ef4444',
    label: 'ご入店いただけません',
    sub: '20歳以上の方のみ',
  },
  id_check: {
    color: '#f59e0b',
    label: '身分証をご提示ください',
    sub: 'スタッフが確認します',
  },
  pass: {
    color: '#22c55e',
    label: 'お入りください',
    sub: 'ようこそ',
  },
};

export function getVerdict(face: FaceAnalysis): Verdict {
  if (face.ageHigh < HARD_BLOCK_THRESHOLD) return 'block';
  if (face.ageLow < ID_CHECK_THRESHOLD) return 'id_check';
  return 'pass';
}

type Props = {
  face: FaceAnalysis;
  onReset: () => void;
  onLogId: () => void;
};

export function ResultOverlay({ face, onReset, onLogId }: Props) {
  const verdict = getVerdict(face);
  const style = VERDICT_STYLES[verdict];
  const ageMid = Math.round((face.ageLow + face.ageHigh) / 2);

  return (
    <Pressable onPress={onReset} className="absolute inset-0">
      {/* 枠全体をキオスクLEDバーで囲む */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 10,
          backgroundColor: style.color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 10,
          backgroundColor: style.color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 10,
          backgroundColor: style.color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 10,
          backgroundColor: style.color,
        }}
      />

      {/* 中央: 体温計風のLCDパネル（管理者用: 1秒ロングプレスでキャリブレーション記録） */}
      <View className="flex-1 items-center justify-center">
        <Pressable
          onPress={onReset}
          onLongPress={onLogId}
          delayLongPress={1000}
          className="bg-black/90 rounded-3xl px-12 py-8 items-center"
          style={{ borderWidth: 4, borderColor: style.color }}
        >
          <Text
            className="text-white/60 text-xs font-bold mb-2"
            style={{ letterSpacing: 10 }}
          >
            推定年齢
          </Text>
          <Text
            style={{
              color: style.color,
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
        </Pressable>
      </View>

      {/* 下段: 判定バナー */}
      <SafeAreaView edges={['bottom']} className="items-center">
        <View
          className="px-10 py-5 rounded-full mb-4"
          style={{ backgroundColor: style.color }}
        >
          <Text className="text-white text-3xl font-bold text-center">
            {style.label}
          </Text>
        </View>
        <Text className="text-white/60 text-sm mb-3">{style.sub}</Text>
        <Text className="text-white/40 text-[10px] mb-6">
          ※ 推定値です。法的な年齢確認ではありません。
        </Text>
      </SafeAreaView>
    </Pressable>
  );
}
