/**
 * Tower Screen – 積読タワー
 *
 * 設計書 5章・5-2 仕様
 *
 * ─ 機能 ──────────────────────────────────────────────────────
 * - 積読本をページ数×0.1mm で実寸換算した厚みで ScrollView に積み上げ
 * - 古い本が下・新しい本が上（created_at ASC = 下から積み上げ）
 * - 右側に設計書5-2の比較オブジェクト SVG シルエットを同スケールで absolute 配置
 * - 合計高さを cm/m で上部ヘッダーに表示
 * - 本追加時 LayoutAnimation で押し上げアニメーション
 *   （+ Reanimated entering アニメーション with ZoomIn）
 * - 新しい比較段階到達時に祝福バナー
 * - 各本タップで詳細画面へ遷移
 * - lib/towerUtils.ts に高さ計算ロジックを分離
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBookStore } from '@/store/bookStore';
import { BookBlock } from '@/components/tower/BookBlock';
import { ComparisonSvg } from '@/components/tower/ComparisonSvg';
import { CelebrationBanner } from '@/components/tower/CelebrationBanner';
import {
  COMPARISON_MILESTONES,
  comparisonDisplayPx,
  formatHeight,
  getAchievedMilestone,
  getNextMilestone,
  milestoneProgress,
  mmToPx,
  totalHeightMm,
} from '@/lib/towerUtils';
import type { ComparisonObject } from '@/lib/towerUtils';

// Android で LayoutAnimation を有効化（旧アーキテクチャ向け）
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── レイアウト定数 ────────────────────────────────────────────
/** 右カラム（比較オブジェクト）の幅 */
const COMPARISON_COLUMN_W = 88;
/** フロア表示の高さ */
const FLOOR_HEIGHT = 24;
/** タワー上部のパディング (px) */
const TOWER_TOP_PADDING = 40;

export default function TowerScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { books } = useBookStore();

  // ─── スクロールビュー ref ──────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);

  // ─── 祝福バナー state ─────────────────────────────────────
  const [celebration, setCelebration] = useState<ComparisonObject | null>(null);

  // ─── 前回の値を追跡 ───────────────────────────────────────
  const prevBooksLenRef = useRef(books.length);
  const prevAchievedIdRef = useRef<string | null>(null);

  // ─── 計算 ────────────────────────────────────────────────
  /** created_at ASC = 古い順（下から積む） */
  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [books],
  );

  const heightMm = useMemo(() => totalHeightMm(sortedBooks), [sortedBooks]);
  const heightPx = mmToPx(heightMm);

  const achievedMilestone = getAchievedMilestone(heightMm);
  const nextMilestone = getNextMilestone(heightMm);
  const progress = milestoneProgress(heightMm);

  /** 現在表示する比較オブジェクト: 達成済みがあれば次のものを表示、なければ最初 */
  const comparisonObject = nextMilestone ?? achievedMilestone ?? COMPARISON_MILESTONES[0];

  const comparisonPx = comparisonObject ? comparisonDisplayPx(comparisonObject) : 0;

  /** ScrollView コンテンツの合計高さ */
  const contentHeight = Math.max(heightPx, comparisonPx) + FLOOR_HEIGHT + TOWER_TOP_PADDING;

  /** タワー左カラムの幅 */
  const towerColumnW = screenWidth - COMPARISON_COLUMN_W;

  /** 最新の本の ID (entering アニメーション判定用) */
  const newestBookId = sortedBooks.at(-1)?.id;

  // ─── 本追加時の処理 ──────────────────────────────────────
  useEffect(() => {
    if (books.length > prevBooksLenRef.current) {
      // LayoutAnimation: 既存要素の押し上げアニメーション
      LayoutAnimation.configureNext({
        duration: 420,
        create: {
          type: LayoutAnimation.Types.spring,
          springDamping: 0.72,
          property: LayoutAnimation.Properties.scaleXY,
        },
        update: {
          type: LayoutAnimation.Types.spring,
          springDamping: 0.72,
        },
      });

      // 新しい本（スタックの最上部 = 画面の上側）にスクロール
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
    prevBooksLenRef.current = books.length;
  }, [books.length]);

  // ─── マイルストーン達成検出 ──────────────────────────────
  useEffect(() => {
    const currentId = achievedMilestone?.id ?? null;
    if (currentId && currentId !== prevAchievedIdRef.current) {
      setCelebration(achievedMilestone);
    }
    prevAchievedIdRef.current = currentId;
  }, [achievedMilestone]);

  const handleDismissCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  // ─── 比較オブジェクト下端 Y 座標 ─────────────────────────
  // コンテンツ下端（floor 上端）から comparison 分だけ上に配置
  const comparisonBottom = contentHeight - FLOOR_HEIGHT;
  const comparisonTop = comparisonBottom - comparisonPx;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ─── ヘッダー ────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>積読タワー</Text>
          <Text style={styles.headerHeight}>{formatHeight(heightMm)}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.bookCountLabel}>
            {sortedBooks.length} <Text style={styles.bookCountUnit}>冊</Text>
          </Text>
        </View>
      </View>

      {/* ─── 次マイルストーン進捗バー ────────────────────── */}
      {nextMilestone && (
        <View style={styles.progressArea}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              次: {nextMilestone.emoji} {nextMilestone.label}（{formatHeight(nextMilestone.heightMm)}）
            </Text>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressBar,
                { width: `${Math.round(progress * 100)}%`, backgroundColor: nextMilestone.color },
              ]}
            />
          </View>
        </View>
      )}
      {!nextMilestone && achievedMilestone && (
        <View style={styles.progressArea}>
          <Text style={styles.progressLabel}>
            🏆 すべてのマイルストーンを達成！
          </Text>
        </View>
      )}

      {/* ─── タワー本体 ──────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { height: contentHeight }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* 本スタック + 比較オブジェクト のコンテナ */}
        <View style={[styles.towerCanvas, { height: contentHeight }]}>

          {/* ── 本の積み上げ（新しい順に上から表示） ────── */}
          <Animated.View
            layout={LinearTransition.springify().damping(20).stiffness(180)}
            style={[
              styles.bookStack,
              { width: towerColumnW, top: TOWER_TOP_PADDING },
            ]}
          >
            {/* 表示は新しい順（上）→古い順（下）: sortedBooks を逆順に */}
            {[...sortedBooks].reverse().map((book) => (
              <BookBlock
                key={book.id}
                book={book}
                columnWidth={towerColumnW}
                isNew={book.id === newestBookId}
              />
            ))}
          </Animated.View>

          {/* ── 床（フロア） ─────────────────────────────── */}
          <View style={[styles.floor, { bottom: 0, width: screenWidth }]}>
            <View style={styles.floorHighlight} />
            <View style={styles.floorMain} />
            <View style={styles.floorShadow} />
          </View>

          {/* ── 比較オブジェクト（右カラム・absolute） ───── */}
          {comparisonObject && comparisonPx > 0 && (
            <View
              style={[
                styles.comparisonWrapper,
                {
                  right: 0,
                  top: comparisonTop,
                  width: COMPARISON_COLUMN_W,
                  height: comparisonPx,
                },
              ]}
            >
              <ComparisonSvg
                object={comparisonObject}
                displayWidth={COMPARISON_COLUMN_W}
              />
              {/* 比較ラベル */}
              <View style={styles.comparisonLabel}>
                <Text style={styles.comparisonEmoji}>{comparisonObject.emoji}</Text>
                <Text style={styles.comparisonName} numberOfLines={1}>
                  {comparisonObject.label}
                </Text>
                <Text style={styles.comparisonHeight}>
                  {formatHeight(comparisonObject.heightMm)}
                </Text>
              </View>
              {/* 高さ基準線 */}
              <View style={styles.comparisonTopLine} />
            </View>
          )}

          {/* ── 合計高さ基準線（タワー最上部） ──────────── */}
          {heightPx > 0 && (
            <View
              style={[
                styles.heightMarkerLine,
                {
                  top: contentHeight - FLOOR_HEIGHT - heightPx,
                  width: towerColumnW,
                },
              ]}
            >
              <View style={styles.heightLine} />
              <Text style={styles.heightMarkerText}>{formatHeight(heightMm)}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── 空状態 ─────────────────────────────────────── */}
      {sortedBooks.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>積読本を追加しよう</Text>
          <Text style={styles.emptySub}>
            「追加」タブで本を登録すると{'\n'}ここにタワーが積み上がります
          </Text>
        </View>
      )}

      {/* ─── 祝福バナー（absolute, z-index 最上位） ─────── */}
      {celebration && (
        <CelebrationBanner
          milestone={celebration}
          onDismiss={handleDismissCelebration}
        />
      )}
    </View>
  );
}

// ─── スタイル ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F0700',
  },

  // ─ ヘッダー
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1A0900',
    borderBottomWidth: 1,
    borderBottomColor: '#3A2010',
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 12,
    color: '#7A6055',
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerHeight: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F5DEB3',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  bookCountLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: '#C4A882',
    fontVariant: ['tabular-nums'],
  },
  bookCountUnit: {
    fontSize: 14,
    color: '#7A6055',
  },

  // ─ 次マイルストーン進捗
  progressArea: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#150700',
    borderBottomWidth: 1,
    borderBottomColor: '#2A1208',
    gap: 5,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11,
    color: '#A8917E',
    flex: 1,
  },
  progressPct: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressBg: {
    height: 5,
    backgroundColor: '#2A1208',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 5,
    borderRadius: 3,
  },

  // ─ スクロールビュー
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ─ タワーキャンバス
  towerCanvas: {
    position: 'relative',
  },

  // ─ 本スタック（左カラム）
  bookStack: {
    position: 'absolute',
    left: 0,
    flexDirection: 'column',
  },

  // ─ 床
  floor: {
    position: 'absolute',
    height: FLOOR_HEIGHT,
    overflow: 'hidden',
  },
  floorHighlight: {
    height: 2,
    backgroundColor: '#9E5830',
    opacity: 0.6,
  },
  floorMain: {
    flex: 1,
    backgroundColor: '#6B4226',
  },
  floorShadow: {
    height: 6,
    backgroundColor: '#1A0A00',
  },

  // ─ 比較オブジェクト（右カラム）
  comparisonWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  comparisonTopLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  comparisonLabel: {
    position: 'absolute',
    bottom: FLOOR_HEIGHT + 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 3,
    borderRadius: 4,
  },
  comparisonEmoji: {
    fontSize: 14,
  },
  comparisonName: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    textAlign: 'center',
  },
  comparisonHeight: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },

  // ─ 合計高さマーカー
  heightMarkerLine: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  heightLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,200,100,0.5)',
  },
  heightMarkerText: {
    fontSize: 9,
    color: '#D97706',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // ─ 空状態
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
    backgroundColor: 'rgba(15,7,0,0.92)',
  },
  emptyEmoji: {
    fontSize: 56,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#C4A882',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#7A6055',
    textAlign: 'center',
    lineHeight: 20,
  },
});
