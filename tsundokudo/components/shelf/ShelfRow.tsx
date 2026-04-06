/**
 * ShelfRow – 木目調棚板 1段コンポーネント
 *
 * - 本の背表紙を横並びで表示
 * - 下部に木目調の棚板（ledge）を描画
 * - 木目の質感は View の重ね合わせで表現
 */
import { StyleSheet, View } from 'react-native';

import { SpineCard } from './SpineCard';
import type { Book } from '@/types/database';
import { WOOD } from '@/constants/colors';
import {
  SHELF_LEDGE_H,
  SHELF_PADDING_H,
  SHELF_SHADOW_H,
  SPINE_HEIGHT,
} from '@/constants/sizes';

type Props = {
  books: Book[];
  onBookPress: (book: Book) => void;
};

export function ShelfRow({ books, onBookPress }: Props) {
  return (
    <View style={styles.container}>
      {/* 書籍エリア */}
      <View style={styles.bookArea}>
        {books.map((book) => (
          <SpineCard key={book.id} book={book} onPress={onBookPress} />
        ))}
      </View>

      {/* 棚板 */}
      <View style={styles.ledge}>
        {/* 棚板上部ハイライト（光が当たる上辺） */}
        <View style={styles.ledgeHighlight} />
        {/* 棚板メイン面 */}
        <View style={styles.ledgeMain}>
          {/* 木目ライン（横方向） */}
          <View style={[styles.grainLine, { top: 4 }]} />
          <View style={[styles.grainLine, { top: 9 }]} />
        </View>
        {/* 棚板前面エッジ（影） */}
        <View style={styles.ledgeEdge} />
      </View>

      {/* 棚板の落ち影 */}
      <View style={styles.shadow} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SHELF_PADDING_H,
    paddingTop: 6,
  },
  bookArea: {
    height: SPINE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  ledge: {
    height: SHELF_LEDGE_H,
    overflow: 'hidden',
  },
  ledgeHighlight: {
    height: 2,
    backgroundColor: WOOD.highlight,
    opacity: 0.7,
  },
  ledgeMain: {
    flex: 1,
    backgroundColor: WOOD.medium,
  },
  grainLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: WOOD.grain,
    opacity: 0.5,
  },
  ledgeEdge: {
    height: 4,
    backgroundColor: WOOD.ledge,
  },
  shadow: {
    height: SHELF_SHADOW_H,
    backgroundColor: WOOD.darkest,
    opacity: 0.55,
    // iOS shadow for the shelf depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
});
