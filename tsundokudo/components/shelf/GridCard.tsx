/**
 * GridCard – グリッドビュー用書籍カード
 *
 * - 表紙画像 (3:4) + タイトル + 著者 + ステータスバッジ
 * - pressIn で scale(0.96) spring アニメーション
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
import { STATUS_BG, STATUS_COLOR, STATUS_LABEL, SPINE_FALLBACK_COLORS } from '@/constants/colors';
import { GRID_ITEM_HEIGHT, GRID_ITEM_WIDTH } from '@/constants/sizes';

type Props = {
  book: Book;
  onPress: (book: Book) => void;
};

function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return SPINE_FALLBACK_COLORS[Math.abs(hash) % SPINE_FALLBACK_COLORS.length] ?? '#4A2008';
}

export function GridCard({ book, onPress }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { stiffness: 400, damping: 22 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { stiffness: 300, damping: 28 });
  }, [scale]);

  const statusColor = STATUS_COLOR[book.reading_status] ?? '#64748B';
  const statusBg = STATUS_BG[book.reading_status] ?? '#EFF2F5';
  const statusLabel = STATUS_LABEL[book.reading_status] ?? '';

  const progress =
    book.total_pages && book.current_page
      ? Math.min(1, book.current_page / book.total_pages)
      : null;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={() => onPress(book)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.container}
      >
        {/* 表紙 */}
        <View style={styles.coverWrapper}>
          {book.cover_url ? (
            <Image
              source={{ uri: book.cover_url }}
              style={styles.cover}
              contentFit="cover"
              transition={250}
            />
          ) : (
            <View style={[styles.cover, { backgroundColor: pickColor(book.id) }]}>
              <Text style={styles.placeholderTitle} numberOfLines={4}>
                {book.title}
              </Text>
            </View>
          )}
          {/* 進捗バー */}
          {progress !== null && (
            <View style={styles.progressBg}>
              <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}
          {/* ステータスバッジ */}
          <View style={[styles.badge, { backgroundColor: statusBg }]}>
            <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* テキスト情報 */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {book.title}
          </Text>
          {book.author ? (
            <Text style={styles.author} numberOfLines={1}>
              {book.author}
            </Text>
          ) : null}
          {book.rating ? (
            <Text style={styles.rating}>{'★'.repeat(book.rating)}</Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: GRID_ITEM_WIDTH,
  },
  coverWrapper: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_HEIGHT,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cover: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  placeholderTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  progressBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#60A5FA',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '700',
  },
  info: {
    paddingTop: 5,
    gap: 2,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 15,
  },
  author: {
    fontSize: 10,
    color: '#64748B',
  },
  rating: {
    fontSize: 9,
    color: '#F59E0B',
    letterSpacing: 1,
  },
});
