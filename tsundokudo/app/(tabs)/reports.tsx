/**
 * レポート一覧（ホーム）
 * - 会社ごとのフォルダ（開閉グループ）にまとめて表示
 * - 「＋新規作成」で入力フォームへ
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { calcBilling, yen } from '@/lib/billing';
import { C } from '@/constants/colors';
import { formatWorkDate } from '@/lib/format';
import type { MaintenanceReport } from '@/types/report';

const NO_COMPANY = '未分類';

function ReportCard({ r }: { r: MaintenanceReport }) {
  const billing = calcBilling(r);
  const doneCount = r.checklist.filter((c) => c.checked).length;
  const allPhotos = [
    ...r.photos,
    ...r.checklist.flatMap((c) => c.photos),
    ...r.pestControl.photos,
    ...r.diy.flatMap((d) => d.photos),
    ...r.annualSchedule.photos,
  ];
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/report/${r.id}`)}
    >
      <View style={styles.itemTop}>
        <Text style={styles.itemStore} numberOfLines={1}>
          {r.storeName || '（店舗未設定）'}
          {r.company ? <Text style={styles.itemCompany}>　{r.company}</Text> : null}
        </Text>
        <Text style={styles.itemDate}>{formatWorkDate(r.workDate) || '日付未設定'}</Text>
      </View>
      <View style={styles.itemRow}>
        <Text style={styles.itemMeta}>担当: {r.technician || '—'}</Text>
        <Text style={styles.itemMeta}>
          点検 {doneCount}/{r.checklist.length}
        </Text>
        {allPhotos.length > 0 && <Text style={styles.itemMeta}>写真 {allPhotos.length}枚</Text>}
      </View>
      {allPhotos.length > 0 && (
        <View style={styles.thumbStrip}>
          {allPhotos.slice(0, 4).map((ph) => (
            <Image key={ph.id} source={{ uri: ph.uri }} style={styles.thumb} contentFit="cover" />
          ))}
        </View>
      )}
      <View style={styles.itemBottom}>
        <Text style={styles.itemPlan}>{r.contractPlan || 'プラン未設定'}</Text>
        <Text style={styles.itemAmount}>¥{yen(billing.taxIncluded)}</Text>
      </View>
    </Pressable>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const reports = useReportStore((s) => s.reports);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // 会社ごとにグループ化（各グループ内は新しい順）
  const groups = useMemo(() => {
    const sorted = [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const map = new Map<string, MaintenanceReport[]>();
    for (const r of sorted) {
      const key = r.company || NO_COMPANY;
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    // 会社名順（未分類は最後）
    return [...map.entries()].sort(([a], [b]) => {
      if (a === NO_COMPANY) return 1;
      if (b === NO_COMPANY) return -1;
      return a.localeCompare(b, 'ja');
    });
  }, [reports]);

  function toggle(company: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>WINWIN メンテナンス報告書</Text>
        <Text style={styles.headerSub}>定期点検・作業記録</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 6 }}>
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>まだレポートがありません</Text>
            <Text style={styles.emptySub}>右下のボタンから作成できます</Text>
          </View>
        ) : (
          groups.map(([company, list]) => {
            const isOpen = !collapsed.has(company);
            return (
              <View key={company}>
                <Pressable style={styles.folder} onPress={() => toggle(company)}>
                  <Text style={styles.folderCaret}>{isOpen ? '▾' : '▸'}</Text>
                  <Text style={styles.folderName} numberOfLines={1}>
                    {company}
                  </Text>
                  <Text style={styles.folderCount}>{list.length}件</Text>
                </Pressable>
                {isOpen && list.map((r) => <ReportCard key={r.id} r={r} />)}
              </View>
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
  emptyText: { fontSize: 16, color: C.textSub, marginTop: 10, fontWeight: '600' },
  emptySub: { fontSize: 13, color: C.textFaint, marginTop: 4 },
  folder: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 2,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.primaryLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFE6E0',
  },
  folderCaret: { fontSize: 14, color: C.primaryDark, width: 20 },
  folderName: { flex: 1, fontSize: 15, fontWeight: '800', color: C.primaryDark },
  folderCount: { fontSize: 12, fontWeight: '700', color: C.primaryDark },
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
  itemCompany: { fontSize: 12, fontWeight: '600', color: C.textSub },
  itemDate: { fontSize: 13, color: C.primaryDark, fontWeight: '600' },
  itemRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  itemMeta: { fontSize: 12, color: C.textSub },
  thumbStrip: { flexDirection: 'row', gap: 6, marginTop: 8 },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: C.border },
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
