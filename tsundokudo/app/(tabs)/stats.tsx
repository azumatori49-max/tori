/**
 * StatsScreen – 読書統計
 *
 * - KPIカード: 総冊数 / 読了 / 積読 / 総ページ / 平均評価
 * - 月別読了バーグラフ (react-native-gifted-charts)
 * - ステータス別ドーナツチャート
 * - 年間読書目標設定 (MMKV) + ProgressBar
 */
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-gifted-charts';

import { useBookStore } from '@/store/bookStore';
import { STATUS_COLOR, STATUS_LABEL } from '@/constants/colors';
import { storage } from '@/lib/mmkv';
import type { ReadingStatus } from '@/types/database';

// ─── MMKV キー ────────────────────────────────────────────────
const GOAL_KEY = 'readingGoal:annual';

function getGoal(): number {
  return storage.getNumber(GOAL_KEY) ?? 0;
}

function setGoal(n: number): void {
  storage.set(GOAL_KEY, n);
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { books } = useBookStore();

  const [annualGoal, setAnnualGoal] = useState(getGoal);
  const [goalInput, setGoalInput] = useState(String(annualGoal || ''));
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  // ─── KPI 計算 ──────────────────────────────────────────
  const kpi = useMemo(() => {
    const total = books.length;
    const completed = books.filter((b) => b.reading_status === 'completed').length;
    const unread = books.filter((b) => b.reading_status === 'unread').length;
    const reading = books.filter((b) => b.reading_status === 'reading').length;
    const paused = books.filter((b) => b.reading_status === 'paused').length;
    const totalPages = books.reduce((s, b) => s + (b.total_pages ?? 0), 0);
    const rated = books.filter((b) => b.rating != null && b.rating > 0);
    const avgRating =
      rated.length > 0
        ? rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length
        : 0;

    return { total, completed, unread, reading, paused, totalPages, avgRating };
  }, [books]);

  // ─── 月別読了データ (今年) ────────────────────────────
  const monthlyData = useMemo(() => {
    const year = new Date().getFullYear();
    const counts = new Array(12).fill(0) as number[];

    books
      .filter((b) => b.reading_status === 'completed' && b.updated_at)
      .forEach((b) => {
        const d = new Date(b.updated_at);
        if (d.getFullYear() === year) {
          const month = d.getMonth();
          counts[month] = (counts[month] ?? 0) + 1;
        }
      });

    return counts.map((value, i) => ({
      value,
      label: `${i + 1}月`,
      frontColor: value > 0 ? '#D97706' : '#2A1208',
    }));
  }, [books]);

  // ─── ステータス別ドーナツデータ ────────────────────────
  const pieData = useMemo(() => {
    const all: { status: ReadingStatus; count: number }[] = [
      { status: 'unread', count: kpi.unread },
      { status: 'reading', count: kpi.reading },
      { status: 'completed', count: kpi.completed },
      { status: 'paused', count: kpi.paused },
    ];
    const statusCounts = all.filter((d) => d.count > 0);

    return statusCounts.map((d) => ({
      value: d.count,
      color: STATUS_COLOR[d.status] ?? '#64748B',
      text: STATUS_LABEL[d.status] ?? d.status,
    }));
  }, [kpi]);

  // ─── 年間目標 ────────────────────────────────────────
  const goalProgress = annualGoal > 0 ? Math.min(1, kpi.completed / annualGoal) : 0;

  const handleGoalSave = useCallback(() => {
    const n = parseInt(goalInput, 10);
    if (isNaN(n) || n < 0) {
      Alert.alert('エラー', '正の整数を入力してください');
      return;
    }
    setGoal(n);
    setAnnualGoal(n);
    setIsEditingGoal(false);
  }, [goalInput]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ─── ヘッダー ──────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>読書統計</Text>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── KPI カード ──────────────────────────────── */}
        <View style={styles.kpiGrid}>
          <KpiCard label="総冊数" value={String(kpi.total)} emoji="📚" />
          <KpiCard label="読了" value={String(kpi.completed)} emoji="✅" />
          <KpiCard label="積読" value={String(kpi.unread)} emoji="📖" />
          <KpiCard label="総ページ" value={kpi.totalPages.toLocaleString()} emoji="📄" />
          <KpiCard
            label="平均評価"
            value={kpi.avgRating > 0 ? kpi.avgRating.toFixed(1) : '—'}
            emoji="⭐"
          />
        </View>

        {/* ─── 年間読書目標 ───────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>年間読書目標</Text>
            <Pressable onPress={() => setIsEditingGoal(!isEditingGoal)} hitSlop={8}>
              <Text style={styles.editBtn}>{isEditingGoal ? 'キャンセル' : '設定'}</Text>
            </Pressable>
          </View>

          {isEditingGoal ? (
            <View style={styles.goalEditRow}>
              <TextInput
                style={styles.goalInput}
                value={goalInput}
                onChangeText={setGoalInput}
                keyboardType="number-pad"
                placeholder="目標冊数"
                placeholderTextColor="#555"
                maxLength={4}
              />
              <Text style={styles.goalUnit}>冊</Text>
              <Pressable onPress={handleGoalSave} style={styles.goalSaveBtn}>
                <Text style={styles.goalSaveBtnText}>保存</Text>
              </Pressable>
            </View>
          ) : annualGoal > 0 ? (
            <View style={styles.goalDisplay}>
              <Text style={styles.goalFraction}>
                {kpi.completed} / {annualGoal} 冊
              </Text>
              <View style={styles.goalBarOuter}>
                <View
                  style={[
                    styles.goalBarInner,
                    { width: `${Math.round(goalProgress * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.goalPct}>{Math.round(goalProgress * 100)}%達成</Text>
            </View>
          ) : (
            <Text style={styles.goalEmpty}>目標を設定しましょう</Text>
          )}
        </View>

        {/* ─── 月別読了バーグラフ ──────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>月別読了数（{new Date().getFullYear()}年）</Text>
          <View style={styles.chartContainer}>
            <BarChart
              data={monthlyData}
              barWidth={18}
              spacing={8}
              roundedTop
              noOfSections={5}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor="#2A1208"
              yAxisTextStyle={styles.axisText}
              xAxisLabelTextStyle={styles.axisText}
              hideRules
              barBorderRadius={3}
              isAnimated
              animationDuration={600}
            />
          </View>
        </View>

        {/* ─── ステータス別ドーナツ ────────────────────── */}
        {pieData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ステータス分布</Text>
            <View style={styles.pieContainer}>
              <PieChart
                data={pieData}
                donut
                radius={80}
                innerRadius={50}
                innerCircleColor="#0F0700"
                centerLabelComponent={() => (
                  <View style={styles.pieCenter}>
                    <Text style={styles.pieCenterValue}>{kpi.total}</Text>
                    <Text style={styles.pieCenterLabel}>冊</Text>
                  </View>
                )}
              />
              <View style={styles.pieLegend}>
                {pieData.map((d) => (
                  <View key={d.text} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                    <Text style={styles.legendText}>
                      {d.text} ({d.value})
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* 下余白 */}
        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── KPI カード コンポーネント ─────────────────────────────────
function KpiCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiEmoji}>{emoji}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A0900',
    borderBottomWidth: 1,
    borderBottomColor: '#3A2010',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F5DEB3',
  },

  // ─ KPI
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    minWidth: 95,
    backgroundColor: '#1A0900',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A1208',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  kpiEmoji: {
    fontSize: 20,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F5DEB3',
    fontVariant: ['tabular-nums'],
  },
  kpiLabel: {
    fontSize: 10,
    color: '#7A6055',
    fontWeight: '600',
  },

  // ─ セクション
  section: {
    marginBottom: 24,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C4A882',
  },
  editBtn: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },

  // ─ 年間目標
  goalEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalInput: {
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
  },
  goalUnit: {
    fontSize: 14,
    color: '#7A6055',
  },
  goalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#D97706',
  },
  goalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  goalDisplay: {
    gap: 6,
  },
  goalFraction: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F5DEB3',
    fontVariant: ['tabular-nums'],
  },
  goalBarOuter: {
    height: 10,
    backgroundColor: '#1A0900',
    borderRadius: 5,
    overflow: 'hidden',
  },
  goalBarInner: {
    height: 10,
    backgroundColor: '#16A34A',
    borderRadius: 5,
  },
  goalPct: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
    fontVariant: ['tabular-nums'],
  },
  goalEmpty: {
    fontSize: 13,
    color: '#5A4035',
  },

  // ─ チャート
  chartContainer: {
    backgroundColor: '#1A0900',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A1208',
    padding: 12,
    overflow: 'hidden',
  },
  axisText: {
    color: '#5A4035',
    fontSize: 9,
  },
  pieContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0900',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A1208',
    padding: 16,
    gap: 16,
  },
  pieCenter: {
    alignItems: 'center',
  },
  pieCenterValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F5DEB3',
  },
  pieCenterLabel: {
    fontSize: 10,
    color: '#7A6055',
  },
  pieLegend: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#C4A882',
  },
});
