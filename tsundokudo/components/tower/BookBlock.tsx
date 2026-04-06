/**
 * BookBlock – 積読タワーの1冊分ブロック
 *
 * - 表示高さ = bookDisplayPx(totalPages)
 * - タップで詳細画面へ遷移
 * - Reanimated entering アニメーション（新規追加時）
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import type { Book } from '@/types/database';
import { SPINE_FALLBACK_COLORS, STATUS_COLOR } from '@/constants/colors';
import { bookDisplayPx, formatHeight, bookThicknessMm } from '@/lib/towerUtils';

type Props = {
  book: Book;
  /** タワー左カラムの幅 (px) */
  columnWidth: number;
  /** 新規追加されたブロックか (entering アニメーション対象) */
  isNew?: boolean;
};

function pickColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return SPINE_FALLBACK_COLORS[Math.abs(hash) % SPINE_FALLBACK_COLORS.length] ?? '#4A2008';
}

export function BookBlock({ book, columnWidth, isNew = false }: Props) {
  const router = useRouter();
  const blockHeight = bookDisplayPx(book.total_pages);
  const thicknessMm = bookThicknessMm(book.total_pages);
  const accentColor = STATUS_COLOR[book.reading_status] ?? '#64748B';
  const bgColor = pickColor(book.id);

  const handlePress = useCallback(() => {
    // 詳細画面へ遷移 (expo-router)
    // router.push({ pathname: '/book/[id]', params: { id: book.id } });
    console.log('navigate to book detail:', book.id);
  }, [book.id, router]);

  const isVisible = blockHeight >= 20;

  return (
    <Animated.View
      entering={isNew ? ZoomIn.springify().damping(18).stiffness(200) : undefined}
      style={[styles.wrapper, { height: blockHeight, width: columnWidth }]}
    >
      <Pressable
        onPress={handlePress}
        style={[styles.block, { backgroundColor: bgColor }]}
        android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
      >
        {/* ステータスライン（左辺） */}
        <View style={[styles.statusLine, { backgroundColor: accentColor }]} />

        {/* コンテンツ（十分な高さがある場合のみ表示） */}
        {isVisible && (
          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>
              {book.title}
            </Text>
            {blockHeight >= 36 && book.author ? (
              <Text style={styles.author} numberOfLines={1}>
                {book.author}
              </Text>
            ) : null}
          </View>
        )}

        {/* 厚み表示（右端） */}
        {isVisible && (
          <Text style={styles.thickness}>{formatHeight(thicknessMm)}</Text>
        )}

        {/* 本の重ね感（上辺のハイライト） */}
        <View style={styles.topHighlight} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  block: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  statusLine: {
    width: 4,
    alignSelf: 'stretch',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 1,
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
  },
  author: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.6)',
  },
  thickness: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.5)',
    paddingRight: 6,
    fontVariant: ['tabular-nums'],
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
