/**
 * ネズミ駆除タブ
 * - 店舗ごとの契約一覧（状態: 契約中 / 満了間近 / 契約終了、残り日数）
 * - 満了30日前の契約を上部に通知表示
 */
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRatStore } from '@/store/ratStore';
import { useIsViewer } from '@/store/authStore';
import { ratPricing, ratStatus, type RatStatusKey } from '@/lib/ratPlan';
import { yen } from '@/lib/billing';
import { C } from '@/constants/colors';
import type { RatContract } from '@/types/rat';

/** 契約用の日付表示（年付き: 2026/8/25） */
function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return iso;
  return `${m[1]}/${Number(m[2])}/${Number(m[3])}`;
}

const STATUS_STYLE: Record<RatStatusKey, { bg: string; fg: string }> = {
  active: { bg: '#E5F5E9', fg: '#1E7B34' },
  expiring: { bg: '#FFF3D6', fg: '#9A6B00' },
  expired: { bg: '#FDECEC', fg: '#C0392B' },
};

function ContractCard({ c }: { c: RatContract }) {
  const st = ratStatus(c);
  const price = ratPricing(c.tsubo);
  const sty = STATUS_STYLE[st.key];
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/rat/${c.id}`)}
    >
      <View style={styles.itemTop}>
        <Text style={styles.itemStore} numberOfLines={1}>
          {c.storeName || '（店舗未設定）'}
        </Text>
        <View style={[styles.pill, { backgroundColor: sty.bg }]}>
          <Text style={[styles.pillText, { color: sty.fg }]}>{st.label}</Text>
        </View>
      </View>
      <Text style={styles.itemMeta}>
        {c.tsubo ? `${c.tsubo}坪` : '坪数未設定'}
        {price ? `　月額 ¥${yen(price.monthlyFee)}` : c.tsubo > 100 ? '　要見積' : ''}
        {`　点検 ${c.visits.length}回`}
      </Text>
      <Text style={styles.itemMeta}>
        {fmtDate(c.startDate)} 〜 {fmtDate(c.endDate)}
        {st.key === 'expired'
          ? `　満了から${-st.daysLeft}日`
          : `　残り${st.daysLeft}日`}
      </Text>
    </Pressable>
  );
}

export default function RatScreen() {
  const insets = useSafeAreaInsets();
  const contracts = useRatStore((s) => s.contracts);
  const hydrated = useRatStore((s) => s.hydrated);
  const hydrate = useRatStore((s) => s.hydrate);
  const isViewer = useIsViewer();

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  // 満了30日前（〜当日）の契約を通知として表示
  const expiring = useMemo(
    () => contracts.filter((c) => ratStatus(c).key === 'expiring'),
    [contracts],
  );

  const sorted = useMemo(
    () =>
      [...contracts].sort((a, b) => {
        // 満了間近 → 契約中 → 契約終了 の順、同じ状態なら満了日が近い順
        const rank: Record<RatStatusKey, number> = { expiring: 0, active: 1, expired: 2 };
        const ra = rank[ratStatus(a).key];
        const rb = rank[ratStatus(b).key];
        if (ra !== rb) return ra - rb;
        return a.endDate.localeCompare(b.endDate);
      }),
    [contracts],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>ネズミ駆除</Text>
        <Text style={styles.headerSub}>年間契約・毎月点検の管理</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: 10 }}>
        {expiring.length > 0 && (
          <View style={styles.alert}>
            <Text style={styles.alertTitle}>⚠ 契約満了が近い店舗があります</Text>
            {expiring.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/rat/${c.id}`)}>
                <Text style={styles.alertLine}>
                  ・{c.storeName}（残り{ratStatus(c).daysLeft}日 / {fmtDate(c.endDate)}まで）
                </Text>
              </Pressable>
            ))}
            <Text style={styles.alertHint}>タップして契約更新の手続きができます</Text>
          </View>
        )}

        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>まだ契約がありません</Text>
            <Text style={styles.emptySub}>右下のボタンから店舗の契約を登録できます</Text>
          </View>
        ) : (
          sorted.map((c) => <ContractCard key={c.id} c={c} />)
        )}
      </ScrollView>

      {!isViewer && (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          onPress={() => router.push('/rat/new')}
        >
          <Text style={styles.fabPlus}>＋</Text>
          <Text style={styles.fabText}>新規契約</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.headerBg, paddingHorizontal: 18, paddingBottom: 14 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#CFE0F5', fontSize: 12, marginTop: 2 },
  alert: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: '#FFF3D6',
    borderColor: '#F0C36D',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#9A6B00' },
  alertLine: { fontSize: 13.5, color: '#6B4E00', marginTop: 6, textDecorationLine: 'underline' },
  alertHint: { fontSize: 11, color: '#9A6B00', marginTop: 8 },
  item: {
    backgroundColor: '#fff',
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemStore: { flex: 1, fontSize: 16, fontWeight: '800', color: C.text, marginRight: 8 },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '800' },
  itemMeta: { fontSize: 12.5, color: C.textSub, marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.textSub },
  emptySub: { fontSize: 13, color: C.textFaint, marginTop: 6 },
  fab: {
    position: 'absolute',
    right: 18,
    backgroundColor: C.primary,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabPlus: { color: '#fff', fontSize: 18, fontWeight: '800' },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
