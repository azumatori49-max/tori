/**
 * レポート一覧（ホーム）
 * - 保存済みメンテナンスレポートを新しい順に表示
 * - 「＋新規作成」で入力フォームへ
 */
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { calcBilling, yen } from '@/lib/billing';
import { C } from '@/constants/colors';
import { formatWorkDate } from '@/lib/format';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const reports = useReportStore((s) => s.reports);
  const sorted = useMemo(
    () => [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>メンテナンスレポート</Text>
        <Text style={styles.headerSub}>衛生管理・定期点検の記録</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 6 }}
      >
        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🧽</Text>
            <Text style={styles.emptyText}>まだレポートがありません</Text>
            <Text style={styles.emptySub}>右下のボタンから作成できます</Text>
          </View>
        ) : (
          sorted.map((r) => {
            const billing = calcBilling(r);
            const doneCount = r.checklist.filter((c) => c.checked).length;
            return (
              <Pressable
                key={r.id}
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/report/${r.id}`)}
              >
                <View style={styles.itemTop}>
                  <Text style={styles.itemStore} numberOfLines={1}>
                    {r.storeName || '（店舗未設定）'}
                  </Text>
                  <Text style={styles.itemDate}>{formatWorkDate(r.workDate) || '日付未設定'}</Text>
                </View>
                <View style={styles.itemRow}>
                  <Text style={styles.itemMeta}>担当: {r.technician || '—'}</Text>
                  <Text style={styles.itemMeta}>点検 {doneCount}/{r.checklist.length}</Text>
                </View>
                <View style={styles.itemBottom}>
                  <Text style={styles.itemPlan}>{r.contractPlan || 'プラン未設定'}</Text>
                  <Text style={styles.itemAmount}>¥{yen(billing.taxIncluded)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push('/report/new')}
      >
        <Text style={styles.fabPlus}>＋</Text>
        <Text style={styles.fabText}>新規作成</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.headerBg,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  headerSub: { color: '#D6F2EE', fontSize: 13, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: C.textSub, marginTop: 10, fontWeight: '600' },
  emptySub: { fontSize: 13, color: C.textFaint, marginTop: 4 },
  item: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemStore: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1, marginRight: 8 },
  itemDate: { fontSize: 13, color: C.primaryDark, fontWeight: '600' },
  itemRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  itemMeta: { fontSize: 12, color: C.textSub },
  itemBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  itemPlan: { fontSize: 12, color: C.textSub },
  itemAmount: { fontSize: 18, fontWeight: '800', color: C.primary },
  fab: {
    position: 'absolute',
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabPlus: { color: '#FFF', fontSize: 20, fontWeight: '800', marginRight: 6 },
  fabText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
