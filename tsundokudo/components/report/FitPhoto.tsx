/**
 * 写真を撮影したときの縦横比のまま表示する（枠に合わせて切り取らない）。
 * 高さを固定し、幅は写真の比率に合わせる。読み込み前は正方形の枠で表示。
 */
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { C } from '@/constants/colors';

// 極端に細長い写真で枠が伸びすぎないよう、枠の比率だけ制限する（写真自体は全体を表示）
const MIN_RATIO = 0.5;
const MAX_RATIO = 1.8;

export function FitPhoto({ uri, height }: { uri: string; height: number }) {
  const [ratio, setRatio] = useState(1);
  const boxRatio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));

  return (
    <Image
      source={{ uri }}
      style={[styles.img, { height, width: Math.round(height * boxRatio) }]}
      contentFit="contain"
      onLoad={(e) => {
        const { width, height: h } = e.source;
        if (width > 0 && h > 0) setRatio(width / h);
      }}
    />
  );
}

const styles = StyleSheet.create({
  img: { borderRadius: 8, backgroundColor: C.border },
});
