/**
 * 店舗一覧
 * - マスタ登録された店舗ごとに、最終作業日・レポート件数・次回予定を表示
 * - タップでその店舗の新規レポート作成へ
 */
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { C } from '@/constants/colors';
import { formatWorkDate } from '@/lib/format';

export default function StoresScreen() {
  const insets = useSafeAreaInsets();
  const reports = useReportStore((s) => s.reports);
  const stores = useReportStore((s) => s.settings.stores);

  const rows = useMemo(() => {
    return stores.map((name) => {
      const list = reports
        .filter((r) => r.storeName === name)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const last = list[0];
      return {
        name,
        count: list.length,
        lastDate: last?.workDate ?? '',
      };
    });
  }, [stores, reports]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>店舗</Text>
        <Text style={styles.headerSub}>{stores.length}店舗を管理中</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 6 }}>
        {rows.map((row) => (
          <Pressable
            key={row.name}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
            onPress={() =>
              router.push({ pathname: '/report/new', params: { store: row.name } })
            }
          >
            <View style={styles.itemLeft}>
              <Text style={styles.storeName}>{row.name}</Text>
              <Text style={styles.meta}>
                レポート {row.count}件
                {row.lastDate ? `　/　最終作業 ${formatWorkDate(row.lastDate)}` : ''}
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Text style={styles.add}>＋作成</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
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
  item: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLeft: { flex: 1, marginRight: 10 },
  storeName: { fontSize: 16, fontWeight: '700', color: C.text },
  meta: { fontSize: 12, color: C.textSub, marginTop: 4 },
  itemRight: { alignItems: 'flex-end', minWidth: 64 },
  add: { fontSize: 13, fontWeight: '700', color: C.primary },
});
