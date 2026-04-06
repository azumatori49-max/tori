/**
 * BookDetailScreen – 本の詳細/編集画面
 *
 * - 表紙大画像・メタ情報
 * - ステータスピッカー
 * - 星評価 (1–5)
 * - ページ進捗入力
 * - メモタブ (感想 / 読書メモ / ハイライト)
 * - 変更は楽観的更新で Zustand に即反映 → バックグラウンドで Supabase 同期
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useBookStore } from '@/store/bookStore';
import { STATUS_COLOR, STATUS_LABEL } from '@/constants/colors';
import { calcReadingProgress } from '@/types/database';
import type { ReadingStatus, BookUpdate } from '@/types/database';

// ─── 定数 ─────────────────────────────────────────────────────
const STATUSES: ReadingStatus[] = ['unread', 'reading', 'completed', 'paused'];
const MEMO_TABS = ['感想', '読書メモ', 'ハイライト'] as const;
type MemoTab = (typeof MEMO_TABS)[number];

const MEMO_SEPARATOR = '\n---MEMO_TAB_SEP---\n';

// ─── メモの3タブ ⇔ 1フィールド変換 ──────────────────────────
function parseMemoTabs(memo: string | null): Record<MemoTab, string> {
  if (!memo) return { 感想: '', 読書メモ: '', ハイライト: '' };
  const parts = memo.split(MEMO_SEPARATOR);
  return {
    感想: parts[0] ?? '',
    読書メモ: parts[1] ?? '',
    ハイライト: parts[2] ?? '',
  };
}

function serializeMemoTabs(tabs: Record<MemoTab, string>): string | null {
  const s = [tabs['感想'], tabs['読書メモ'], tabs['ハイライト']].join(MEMO_SEPARATOR);
  // 全部空ならnull
  return tabs['感想'] || tabs['読書メモ'] || tabs['ハイライト'] ? s : null;
}

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getBookById, updateBook, deleteBook } = useBookStore();

  const book = getBookById(id ?? '');

  // ─── ローカル編集 state ──────────────────────────────────
  const [status, setStatus] = useState<ReadingStatus>(book?.reading_status ?? 'unread');
  const [rating, setRating] = useState(book?.rating ?? 0);
  const [currentPage, setCurrentPage] = useState(String(book?.current_page ?? ''));
  const [memoTabs, setMemoTabs] = useState(() => parseMemoTabs(book?.memo ?? null));
  const [activeMemoTab, setActiveMemoTab] = useState<MemoTab>('感想');

  // デバウンス用タイマー
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── 自動保存（デバウンス 800ms） ────────────────────────
  const scheduleUpdate = useCallback(
    (patch: BookUpdate) => {
      if (!id) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void updateBook(id, patch);
      }, 800);
    },
    [id, updateBook],
  );

  // ─── イベントハンドラ ──────────────────────────────────
  const handleStatusChange = useCallback(
    (s: ReadingStatus) => {
      setStatus(s);
      // ステータスは即時保存
      if (id) void updateBook(id, { reading_status: s });
    },
    [id, updateBook],
  );

  const handleRatingChange = useCallback(
    (r: number) => {
      const next = r === rating ? 0 : r; // 同じ星タップでリセット
      setRating(next);
      if (id) void updateBook(id, { rating: next || null });
    },
    [id, rating, updateBook],
  );

  const handlePageChange = useCallback(
    (text: string) => {
      setCurrentPage(text);
      const n = parseInt(text, 10);
      if (!isNaN(n) && n >= 0) {
        scheduleUpdate({ current_page: n });
      }
    },
    [scheduleUpdate],
  );

  const handleMemoChange = useCallback(
    (text: string) => {
      const next = { ...memoTabs, [activeMemoTab]: text };
      setMemoTabs(next);
      scheduleUpdate({ memo: serializeMemoTabs(next) });
    },
    [activeMemoTab, memoTabs, scheduleUpdate],
  );

  const handleDelete = useCallback(() => {
    Alert.alert('本を削除', 'この本を本棚から削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          if (id) {
            await deleteBook(id);
            router.back();
          }
        },
      },
    ]);
  }, [id, deleteBook, router]);

  // ─── 読書進捗 ──────────────────────────────────────────
  const progress = useMemo(() => {
    if (!book) return null;
    return calcReadingProgress(book);
  }, [book]);

  // ─── 本が見つからない場合 ──────────────────────────────
  if (!book) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundEmoji}>📖</Text>
          <Text style={styles.notFoundText}>本が見つかりません</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>戻る</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── ヘッダー（戻る + 削除） ────────────────── */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.headerAction}>← 戻る</Text>
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={12}>
              <Text style={[styles.headerAction, styles.deleteAction]}>削除</Text>
            </Pressable>
          </View>

          {/* ─── 表紙 + メタ情報 ────────────────────────── */}
          <Animated.View entering={FadeIn.duration(350)} style={styles.heroSection}>
            {book.cover_url ? (
              <Image
                source={{ uri: book.cover_url }}
                style={styles.coverImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.coverImage, styles.coverPlaceholder]}>
                <Text style={styles.coverPlaceholderText}>📚</Text>
              </View>
            )}

            <View style={styles.metaBlock}>
              <Text style={styles.title} numberOfLines={3}>
                {book.title}
              </Text>
              {book.author ? (
                <Text style={styles.author} numberOfLines={1}>
                  {book.author}
                </Text>
              ) : null}
              {book.publisher ? (
                <Text style={styles.publisher} numberOfLines={1}>
                  {book.publisher}
                </Text>
              ) : null}
              {book.published_at ? (
                <Text style={styles.published}>出版: {book.published_at}</Text>
              ) : null}
              {book.isbn ? (
                <Text style={styles.isbn}>ISBN: {book.isbn}</Text>
              ) : null}
              {book.total_pages ? (
                <Text style={styles.pages}>{book.total_pages}ページ</Text>
              ) : null}
            </View>
          </Animated.View>

          {/* ─── ステータスピッカー ──────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ステータス</Text>
            <View style={styles.statusRow}>
              {STATUSES.map((s) => {
                const active = s === status;
                const color = STATUS_COLOR[s] ?? '#64748B';
                return (
                  <Pressable
                    key={s}
                    onPress={() => handleStatusChange(s)}
                    style={[
                      styles.statusChip,
                      active && { backgroundColor: color, borderColor: color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        active && styles.statusChipTextActive,
                      ]}
                    >
                      {STATUS_LABEL[s] ?? s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ─── 星評価 ─────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>評価</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => handleRatingChange(n)} hitSlop={6}>
                  <Text style={[styles.star, n <= rating && styles.starFilled]}>
                    {n <= rating ? '★' : '☆'}
                  </Text>
                </Pressable>
              ))}
              {rating > 0 && (
                <Text style={styles.ratingValue}>{rating}.0</Text>
              )}
            </View>
          </View>

          {/* ─── ページ進捗 ─────────────────────────────── */}
          {book.total_pages != null && book.total_pages > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>読書進捗</Text>
              <View style={styles.progressInputRow}>
                <TextInput
                  style={styles.pageInput}
                  value={currentPage}
                  onChangeText={handlePageChange}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#555"
                  maxLength={6}
                />
                <Text style={styles.pageTotal}>/ {book.total_pages}ページ</Text>
              </View>
              {progress != null && (
                <View style={styles.progressBarOuter}>
                  <View
                    style={[
                      styles.progressBarInner,
                      { width: `${Math.round(progress * 100)}%` },
                    ]}
                  />
                  <Text style={styles.progressPct}>
                    {Math.round(progress * 100)}%
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ─── タグ ───────────────────────────────────── */}
          {book.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>タグ</Text>
              <View style={styles.tagsRow}>
                {book.tags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ─── メモタブ ───────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>メモ</Text>
            <View style={styles.memoTabRow}>
              {MEMO_TABS.map((tab) => {
                const active = tab === activeMemoTab;
                return (
                  <Pressable
                    key={tab}
                    onPress={() => setActiveMemoTab(tab)}
                    style={[styles.memoTab, active && styles.memoTabActive]}
                  >
                    <Text
                      style={[
                        styles.memoTabText,
                        active && styles.memoTabTextActive,
                      ]}
                    >
                      {tab}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.memoInput}
              value={memoTabs[activeMemoTab]}
              onChangeText={handleMemoChange}
              placeholder={`${activeMemoTab}を入力...`}
              placeholderTextColor="#555"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ─── 日付情報 ───────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>登録情報</Text>
            <Text style={styles.dateText}>
              追加日: {new Date(book.created_at).toLocaleDateString('ja-JP')}
            </Text>
            <Text style={styles.dateText}>
              更新日: {new Date(book.updated_at).toLocaleDateString('ja-JP')}
            </Text>
          </View>

          {/* 下余白 */}
          <View style={{ height: insets.bottom + 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── スタイル ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F0700',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // ─ ヘッダー
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },
  deleteAction: {
    color: '#EF4444',
  },

  // ─ ヒーロー（表紙 + メタ）
  heroSection: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  coverImage: {
    width: 120,
    height: 176,
    borderRadius: 8,
    backgroundColor: '#1A0900',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A2010',
  },
  coverPlaceholderText: {
    fontSize: 40,
  },
  metaBlock: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F5DEB3',
    lineHeight: 24,
  },
  author: {
    fontSize: 14,
    color: '#C4A882',
    fontWeight: '600',
  },
  publisher: {
    fontSize: 12,
    color: '#7A6055',
  },
  published: {
    fontSize: 11,
    color: '#7A6055',
    marginTop: 4,
  },
  isbn: {
    fontSize: 10,
    color: '#5A4035',
    fontVariant: ['tabular-nums'],
  },
  pages: {
    fontSize: 11,
    color: '#7A6055',
    marginTop: 2,
  },

  // ─ セクション共通
  section: {
    marginBottom: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7A6055',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ─ ステータスピッカー
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#3A2010',
    backgroundColor: 'transparent',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A6055',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },

  // ─ 星評価
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  star: {
    fontSize: 28,
    color: '#3A2010',
  },
  starFilled: {
    color: '#F59E0B',
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 8,
  },

  // ─ 読書進捗
  progressInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageInput: {
    width: 80,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A2010',
    backgroundColor: '#1A0900',
    color: '#F5DEB3',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  pageTotal: {
    fontSize: 14,
    color: '#7A6055',
  },
  progressBarOuter: {
    height: 8,
    backgroundColor: '#1A0900',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarInner: {
    height: 8,
    backgroundColor: '#16A34A',
    borderRadius: 4,
  },
  progressPct: {
    position: 'absolute',
    right: 4,
    top: -16,
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    fontVariant: ['tabular-nums'],
  },

  // ─ タグ
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#2A1208',
  },
  tagText: {
    fontSize: 11,
    color: '#C4A882',
  },

  // ─ メモタブ
  memoTabRow: {
    flexDirection: 'row',
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#2A1208',
  },
  memoTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  memoTabActive: {
    borderBottomColor: '#D97706',
  },
  memoTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A4035',
  },
  memoTabTextActive: {
    color: '#D97706',
  },
  memoInput: {
    minHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A1208',
    backgroundColor: '#1A0900',
    color: '#F5DEB3',
    fontSize: 14,
    lineHeight: 22,
    padding: 12,
  },

  // ─ 日付
  dateText: {
    fontSize: 11,
    color: '#5A4035',
  },

  // ─ 未発見
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  notFoundEmoji: {
    fontSize: 56,
  },
  notFoundText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7A6055',
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2A1208',
    marginTop: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },
});
