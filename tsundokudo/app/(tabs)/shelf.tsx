/**
 * Shelf Screen – 積読道 メイン本棚画面
 *
 * ─ 機能 ──────────────────────────────────────────────────────
 * - 棚ビュー: 木目調本棚に背表紙 (aspectRatio 0.25) を並べる
 * - グリッドビュー: 表紙画像 3列グリッド
 * - トグルボタンで切替
 * - FlashList (v2) によるリスト仮想化
 * - pressIn で translateY(-14) spring アニメーション（SpineCard）
 * - ステータス別フィルター / テキスト検索 / ソート
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import type { FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShelfRow } from '@/components/shelf/ShelfRow';
import { GridCard } from '@/components/shelf/GridCard';
import { useShelfBooks, SORT_OPTIONS } from '@/hooks/useShelfBooks';
import type { SortKey, StatusFilter } from '@/hooks/useShelfBooks';
import { STATUS_COLOR, STATUS_LABEL, WOOD } from '@/constants/colors';
import {
  GRID_COLUMNS,
  GRID_GAP,
  GRID_ITEM_HEIGHT,
  GRID_PADDING_H,
  SHELF_ROW_HEIGHT,
} from '@/constants/sizes';
import type { Book, ReadingStatus } from '@/types/database';

// ─── 型 ──────────────────────────────────────────────────────
type ViewMode = 'shelf' | 'grid';

// ─── 定数 ────────────────────────────────────────────────────
const STATUS_FILTERS: { key: StatusFilter; emoji: string }[] = [
  { key: 'all', emoji: '📚' },
  { key: 'unread', emoji: '📖' },
  { key: 'reading', emoji: '🔖' },
  { key: 'completed', emoji: '✅' },
  { key: 'paused', emoji: '⏸' },
];

const GRID_ROW_HEIGHT = GRID_ITEM_HEIGHT + 48 + GRID_GAP;

// ─── メインコンポーネント ─────────────────────────────────────
export default function ShelfScreen() {
  const insets = useSafeAreaInsets();

  const {
    filteredBooks,
    shelfRows,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortKey,
    setSortKey,
  } = useShelfBooks();

  const [viewMode, setViewMode] = useState<ViewMode>('shelf');
  const [sortModalOpen, setSortModalOpen] = useState(false);

  // FlashList v2: ref 型は FlashListRef<T>
  const shelfListRef = useRef<FlashListRef<Book[]>>(null);
  const gridListRef = useRef<FlashListRef<Book>>(null);

  // ─── ハンドラ ──────────────────────────────────────────────
  const handleBookPress = useCallback((book: Book) => {
    // TODO: 詳細画面へ遷移 (expo-router router.push)
    console.log('book pressed:', book.id);
  }, []);

  const handleStatusChange = useCallback(
    (key: StatusFilter) => {
      setStatusFilter(key);
      // スクロール位置をトップへリセット
      shelfListRef.current?.scrollToOffset({ offset: 0, animated: false });
      gridListRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [setStatusFilter],
  );

  const handleSortSelect = useCallback(
    (key: SortKey) => {
      setSortKey(key);
      setSortModalOpen(false);
    },
    [setSortKey],
  );

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? '追加順';

  // ─── FlashList レンダラー ──────────────────────────────────
  const renderShelfRow = useCallback(
    ({ item }: { item: Book[] }) => (
      <ShelfRow books={item} onBookPress={handleBookPress} />
    ),
    [handleBookPress],
  );

  const renderGridItem = useCallback(
    ({ item }: { item: Book }) => <GridCard book={item} onPress={handleBookPress} />,
    [handleBookPress],
  );

  // ─── 空ステート ────────────────────────────────────────────
  const EmptyState = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>📚</Text>
        <Text style={styles.emptyTitle}>
          {searchQuery ? '該当する本が見つかりません' : '本棚が空です'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? '検索ワードを変えてみてください'
            : '「追加」タブからISBNスキャンで本を登録しよう'}
        </Text>
      </View>
    ),
    [searchQuery],
  );

  const ListHeader = useMemo(
    () =>
      filteredBooks.length > 0 ? (
        <View style={styles.listHeader}>
          <Text style={styles.bookCount}>{filteredBooks.length} 冊</Text>
        </View>
      ) : null,
    [filteredBooks.length],
  );

  return (
    <View style={[styles.screen, { backgroundColor: WOOD.bg }]}>
      {/* ステータスバー分のセーフエリア */}
      <View style={{ height: insets.top, backgroundColor: WOOD.darkest }} />

      {/* ─── 検索バー ─────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="タイトル・著者で検索"
            placeholderTextColor="#8B6B5A"
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        {/* ビュー切替ボタン */}
        <Pressable
          onPress={() => setViewMode((m) => (m === 'shelf' ? 'grid' : 'shelf'))}
          style={styles.viewToggleButton}
          hitSlop={8}
          accessibilityLabel={viewMode === 'shelf' ? 'グリッドビューに切替' : '棚ビューに切替'}
        >
          <Text style={styles.viewToggleIcon}>{viewMode === 'shelf' ? '⊞' : '≡'}</Text>
        </Pressable>
      </View>

      {/* ─── フィルター & ソート行 ─────────────────────────── */}
      <View style={styles.filterSortRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {STATUS_FILTERS.map(({ key, emoji }) => {
            const isActive = statusFilter === key;
            const color =
              key === 'all'
                ? '#D97706'
                : (STATUS_COLOR[key as ReadingStatus] ?? '#64748B');
            return (
              <Pressable
                key={key}
                onPress={() => handleStatusChange(key)}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: color, borderColor: color },
                ]}
                accessibilityLabel={`${STATUS_LABEL[key]}でフィルター`}
              >
                <Text style={styles.filterChipEmoji}>{emoji}</Text>
                <Text
                  style={[
                    styles.filterChipLabel,
                    { color: isActive ? '#FFFFFF' : '#A8917E' },
                    isActive && styles.filterChipLabelActive,
                  ]}
                >
                  {STATUS_LABEL[key]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ソートボタン */}
        <Pressable
          onPress={() => setSortModalOpen(true)}
          style={styles.sortButton}
          hitSlop={4}
          accessibilityLabel="並び替え"
        >
          <Text style={styles.sortIcon}>↕</Text>
          <Text style={styles.sortLabel} numberOfLines={1}>
            {currentSortLabel.length > 6 ? currentSortLabel.slice(0, 5) + '…' : currentSortLabel}
          </Text>
        </Pressable>
      </View>

      {/* ─── メインコンテンツ ─────────────────────────────── */}
      {loading && filteredBooks.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#D97706" size="large" />
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyTitle}>読み込みエラー</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
        </View>
      ) : viewMode === 'shelf' ? (
        /* ─── 棚ビュー ────────────────────────────────────────── */
        <FlashList<Book[]>
          ref={shelfListRef}
          data={shelfRows}
          renderItem={renderShelfRow}
          keyExtractor={(_, index) => `row-${index}`}
          ListEmptyComponent={EmptyState}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
          // FlashList v2: estimatedItemSize は廃止。固定高さの hint のみ
          getItemType={() => 'shelf-row'}
        />
      ) : (
        /* ─── グリッドビュー ──────────────────────────────────── */
        <FlashList<Book>
          ref={gridListRef}
          data={filteredBooks}
          renderItem={renderGridItem}
          numColumns={GRID_COLUMNS}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={EmptyState}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{
            paddingHorizontal: GRID_PADDING_H,
            paddingBottom: insets.bottom + 16,
          }}
          ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
          showsVerticalScrollIndicator={false}
          getItemType={() => 'grid-item'}
          // numColumns 使用時にアイテム間の水平 gap を付与するため
          // CellRendererComponent に paddingRight をつける
          overrideItemLayout={(layout, _item, index) => {
            // 行の最後以外に右マージンを設定（numColumns 使用時）
            const col = index % GRID_COLUMNS;
            layout.span = col === GRID_COLUMNS - 1 ? 1 : 1;
          }}
        />
      )}

      {/* ─── ソートモーダル ────────────────────────────────── */}
      <SortModal
        visible={sortModalOpen}
        currentKey={sortKey}
        onSelect={handleSortSelect}
        onClose={() => setSortModalOpen(false)}
      />

      {/* ─── 更新中インジケーター（データあり時） ───────────── */}
      {loading && filteredBooks.length > 0 && (
        <View style={styles.refreshIndicator} pointerEvents="none">
          <ActivityIndicator color="#D97706" size="small" />
        </View>
      )}
    </View>
  );
}

// ─── ソートモーダル ───────────────────────────────────────────
type SortModalProps = {
  visible: boolean;
  currentKey: SortKey;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
};

function SortModal({ visible, currentKey, onSelect, onClose }: SortModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        {/* Pressable の伝播防止 */}
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>並び替え</Text>
          {SORT_OPTIONS.map((opt) => {
            const isActive = opt.key === currentKey;
            return (
              <Pressable
                key={opt.key}
                onPress={() => onSelect(opt.key)}
                style={[styles.sortOption, isActive && styles.sortOptionActive]}
              >
                <Text
                  style={[styles.sortOptionText, isActive && styles.sortOptionTextActive]}
                >
                  {opt.label}
                </Text>
                {isActive && <Text style={styles.sortOptionCheck}>✓</Text>}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── スタイル ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // ─ 検索バー
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: WOOD.darkest,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E1A0A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#5C3520',
    gap: 6,
  },
  searchIcon: {
    fontSize: 13,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#F5E6D3',
    padding: 0,
    margin: 0,
  },
  viewToggleButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#2E1A0A',
    borderWidth: 1,
    borderColor: '#5C3520',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggleIcon: {
    fontSize: 18,
    color: '#D97706',
  },

  // ─ フィルター & ソート
  filterSortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WOOD.darkest,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: WOOD.dark,
  },
  filterScrollContent: {
    paddingHorizontal: 12,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A2010',
    backgroundColor: '#2A1208',
    gap: 4,
  },
  filterChipEmoji: {
    fontSize: 11,
  },
  filterChipLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipLabelActive: {
    fontWeight: '700',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 12,
    gap: 4,
    borderRadius: 8,
    backgroundColor: '#2A1208',
    borderWidth: 1,
    borderColor: '#3A2010',
  },
  sortIcon: {
    fontSize: 12,
    color: '#D97706',
  },
  sortLabel: {
    fontSize: 10,
    color: '#A8917E',
    fontWeight: '600',
  },

  // ─ リストヘッダー
  listHeader: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 2,
  },
  bookCount: {
    fontSize: 11,
    color: '#7A6055',
    fontWeight: '600',
  },

  // ─ 空ステート
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 52,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C4A882',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#7A6055',
    textAlign: 'center',
    lineHeight: 19,
  },

  // ─ ローディング
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIndicator: {
    position: 'absolute',
    top: 100,
    right: 16,
    padding: 6,
    backgroundColor: 'rgba(30,10,0,0.8)',
    borderRadius: 20,
  },

  // ─ ソートモーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1C0E04',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#3A2010',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#5C3520',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D4B896',
    marginBottom: 12,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3A2010',
  },
  sortOptionActive: {},
  sortOptionText: {
    fontSize: 14,
    color: '#A8917E',
  },
  sortOptionTextActive: {
    color: '#D97706',
    fontWeight: '700',
  },
  sortOptionCheck: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '700',
  },
});
