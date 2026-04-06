/**
 * CelebrationBanner – マイルストーン達成時の祝福バナー
 *
 * - 達成した比較オブジェクトとメッセージを表示
 * - Reanimated 4 SlideInDown + FadeOut でアニメーション
 * - 3 秒後に自動消去（または dismiss タップ）
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeOut,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import type { ComparisonObject } from '@/lib/towerUtils';
import { formatHeight } from '@/lib/towerUtils';

const AUTO_DISMISS_MS = 3500;

type Props = {
  milestone: ComparisonObject;
  onDismiss: () => void;
};

export function CelebrationBanner({ milestone, onDismiss }: Props) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    // AUTO_DISMISS_MS 後にフェードアウトして onDismiss を呼ぶ
    opacity.value = withDelay(
      AUTO_DISMISS_MS,
      withTiming(0, { duration: 500 }, (finished) => {
        if (finished) {
          runOnJS(onDismiss)();
        }
      }),
    );
  }, [milestone.id, onDismiss, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18).stiffness(220)}
      exiting={FadeOut.duration(300)}
      style={[styles.container, animatedStyle]}
    >
      <Pressable onPress={onDismiss} style={styles.inner}>
        {/* 背景グラデーション風（重ねViewで代替） */}
        <View style={[styles.bg, { backgroundColor: milestone.color }]} />
        <View style={styles.bgOverlay} />

        {/* コンテンツ */}
        <View style={styles.content}>
          <Text style={styles.sparkle}>🎉</Text>
          <View style={styles.textBlock}>
            <Text style={styles.headline}>マイルストーン達成！</Text>
            <Text style={styles.milestoneLabel}>
              {milestone.emoji} {milestone.label}({formatHeight(milestone.heightMm)})と同じ高さ！
            </Text>
            <Text style={styles.sub}>{milestone.description}</Text>
          </View>
          <Text style={styles.dismiss}>✕</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.88,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  inner: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  sparkle: {
    fontSize: 28,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  headline: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  milestoneLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 13,
  },
  dismiss: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    padding: 4,
  },
});
