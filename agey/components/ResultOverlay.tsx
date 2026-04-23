import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { HARD_BLOCK_THRESHOLD, ID_CHECK_THRESHOLD } from '../constants/config';
import type { FaceAnalysis } from '../lib/rekognition';

type Verdict = 'block' | 'id_check' | 'pass';

type VerdictStyle = {
  bg: string;
  emoji: string;
  headline: string;
  subline: string;
};

const VERDICT_STYLES: Record<Verdict, VerdictStyle> = {
  block: {
    bg: 'bg-red-600/95',
    emoji: '🛑',
    headline: '20歳以上の方のみ\nご入店いただけます',
    subline: '申し訳ございません',
  },
  id_check: {
    bg: 'bg-amber-500/95',
    emoji: '🪪',
    headline: '身分証のご提示を\nお願いします',
    subline: 'スタッフが確認いたします',
  },
  pass: {
    bg: 'bg-emerald-600/95',
    emoji: '✅',
    headline: 'お入りください',
    subline: 'ようこそ鶏ヤローへ',
  },
};

function getVerdict(face: FaceAnalysis): Verdict {
  if (face.ageHigh < HARD_BLOCK_THRESHOLD) return 'block';
  if (face.ageLow < ID_CHECK_THRESHOLD) return 'id_check';
  return 'pass';
}

type Props = {
  face: FaceAnalysis;
  onReset: () => void;
};

export function ResultOverlay({ face, onReset }: Props) {
  const verdict = getVerdict(face);
  const style = VERDICT_STYLES[verdict];

  return (
    <Pressable
      onPress={onReset}
      className={`absolute inset-0 items-center justify-center p-8 ${style.bg}`}
    >
      <Text className="text-[120px] leading-[130px] mb-4">{style.emoji}</Text>
      <Text className="text-white text-4xl font-bold text-center mb-3">
        {style.headline}
      </Text>
      <Text className="text-white/90 text-lg mb-8">{style.subline}</Text>
      <Text className="text-white/70 text-sm">
        推定年齢: {face.ageLow}〜{face.ageHigh} 歳
        {face.faceCount > 1 ? ` / ${face.faceCount}名検出` : ''}
      </Text>
      <Text className="text-white/50 text-xs mt-2">
        ※ 推定値です。法的な年齢確認ではありません。
      </Text>
    </Pressable>
  );
}
