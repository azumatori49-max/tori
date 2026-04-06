/**
 * SpineCard – 背表紙コンポーネント
 *
 * - aspectRatio 0.25 (SPINE_WIDTH × SPINE_HEIGHT)
 * - pressIn で translateY(-14) spring アニメーション (Reanimated 4)
 * - cover_url がある場合は表紙をクロップ表示、なければ色 + タイトル
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

import type { Book } from '@/types/database';
import { SPINE_FALLBACK_COLORS } from '@/constants/colors';
import { PRESS_LIFT_Y, SPINE_GAP, SPINE_HEIGHT, SPINE_WIDTH } from '@/constants/sizes';

// pressIn/pressOut 共通スプリング設定
const LIFT_CONFIG = { stiffness: 380, damping: 22, mass: 1 } as const;
const DROP_CONFIG = { stiffness: 260, damping: 28, mass: 1 } as const;

type Props = {
  book: Book;
  onPress: (book: Book) => void;
};

/** 書籍 ID から決定論的に fallback 色を返す */
function pickSpineColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  const idx = Math.abs(hash) % SPINE_FALLBACK_COLORS.length;
  return SPINE_FALLBACK_COLORS[idx] ?? '#4A2008';
}

export function SpineCard({ book, onPress }: Props) {
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handlePressIn = useCallback(() => {
    translateY.value = withSpring(PRESS_LIFT_Y, LIFT_CONFIG);
  }, [translateY]);

  const handlePressOut = useCallback(() => {
    translateY.value = withSpring(0, DROP_CONFIG);
  }, [translateY]);

  const handlePress = useCallback(() => {
    onPress(book);
  }, [book, onPress]);

  const spineColor = pickSpineColor(book.id);

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
      >
        {book.cover_url ? (
          <Image
            source={{ uri: book.cover_url }}
            style={styles.cover}
            contentFit="cover"
            contentPosition="left center"
            transition={200}
          />
        ) : (
          <View style={[styles.cover, { backgroundColor: spineColor }]}>
            <RotatedTitle title={book.title} />
          </View>
        )}
        {/* 背表紙の左辺に光沢ライン */}
        <View style={styles.shineLeft} />
        {/* 背表紙の右辺に影ライン */}
        <View style={styles.shadowRight} />
      </Pressable>
    </Animated.View>
  );
}

/** タイトルを縦書き風に回転表示する内部コンポーネント */
function RotatedTitle({ title }: { title: string }) {
  return (
    <View style={styles.titleContainer}>
      <Text style={styles.titleText} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: SPINE_WIDTH,
    height: SPINE_HEIGHT,
    marginRight: SPINE_GAP,
    // 本の底面の影
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
    elevation: 5,
  },
  pressable: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 1,
  },
  cover: {
    width: SPINE_WIDTH,
    height: SPINE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    // SPINE_HEIGHT 幅のテキストを 90° 回転して SPINE_WIDTH 内に収める
    width: SPINE_HEIGHT - 8,
    height: SPINE_WIDTH,
    position: 'absolute',
    top: SPINE_HEIGHT / 2 - SPINE_WIDTH / 2,
    left: -(SPINE_HEIGHT - SPINE_WIDTH) / 2,
    transform: [{ rotate: '90deg' }],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  titleText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.3,
  },
  shineLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  shadowRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});
