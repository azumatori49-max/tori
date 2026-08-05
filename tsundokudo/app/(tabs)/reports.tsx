/**
 * レポート一覧（ホーム）
 * - 会社ごとのフォルダ（開閉グループ）にまとめて表示
 * - 「＋新規作成」で入力フォームへ
 */
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { useIsViewer } from '@/store/authStore';
import { calcBilling, yen } from '@/lib/billing';
import { C } from '@/constants/colors';
import { formatWorkDate } from '@/lib/format';
import { confirmAsync, notify } from '@/lib/dialog';
import logoAsset from '@/assets/logo.png';
import type { MaintenanceReport } from '@/types/report';

const NO_COMPANY = '未分類';

/** 請求済みレポートの月グループキー（施工日→なければ作成日から） */
function monthKeyOf(r: MaintenanceReport): { sort: string; label: string } {
  const iso = r.workDate.match(/^(\d{4})-(\d{1,2})/);
  if (iso?.[1] && iso[2]) {
    return {
      sort: `${iso[1]}-${iso[2].padStart(2, '0')}`,
      label: `${iso[1]}年${Number(iso[2])}月`,
    };
  }
  const md = r.workDate.match(/^(\d{1,2})\//);
  const cy = r.createdAt.slice(0, 4);
  if (md?.[1]) {
    return {
      sort: `${cy}-${md[1].padStart(2, '0')}`,
      label: `${cy}年${Number(md[1])}月`,
    };
  }
  const cm = r.createdAt.slice(5, 7);
  return { sort: `${cy}-${cm}`, label: `${cy}年${Number(cm)}月` };
}

function ReportCard({ r, readOnly }: { r: MaintenanceReport; readOnly: boolean }) {
  const deleteReport = useReportStore((s) => s.deleteReport);
  const updateReport = useReportStore((s) => s.updateReport);
  const billing = calcBilling(r);
  const doneCount = r.checklist.filter((c) => c.checked).length;

  // 請求対応（鈴木さん）チェック。付けると月別グループへ移動する
  async function onToggleBilling() {
    const ok = await updateReport(r.id, { billingDone: !r.billingDone });
    if (!ok) {
      notify('更新できませんでした', useReportStore.getState().error ?? '');
    }
  }

  async function onDelete() {
    const label = `${r.storeName || '（店舗未設定）'}${
      formatWorkDate(r.workDate) ? '（' + formatWorkDate(r.workDate) + '）' : ''
    }`;
    const ok = await confirmAsync(
      'レポートを削除',
      `${label} のレポートを削除します。この操作は取り消せません。`,
      '削除',
    );
    if (!ok) return;
    const done = await deleteReport(r.id);
    if (!done) {
      notify('削除できませんでした', useReportStore.getState().error ?? '');
    }
  }
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
      onPress={() => router.push(readOnly ? `/report/view/${r.id}` : `/report/${r.id}`)}
    >
      <View style={styles.itemTop}>
        <Text style={styles.itemStore} numberOfLines={1}>
          {r.reportType === 'order' && <Text style={styles.orderBadge}>オーダー工事　</Text>}
          {r.storeName || '（店舗未設定）'}
          {r.company ? <Text style={styles.itemCompany}>　{r.company}</Text> : null}
        </Text>
        <Text style={styles.itemDate}>{formatWorkDate(r.workDate) || '日付未設定'}</Text>
      </View>
      <View style={styles.itemRow}>
        <Text style={styles.itemMeta}>担当: {r.technician || '—'}</Text>
        {r.reportType !== 'order' && (
          <Text style={styles.itemMeta}>
            点検 {doneCount}/{r.checklist.length}
          </Text>
        )}
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
        <View style={styles.itemBottomRight}>
          {!readOnly && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                void onToggleBilling();
              }}
              hitSlop={8}
              style={[styles.billCheck, r.billingDone && styles.billCheckOn]}
            >
              {r.billingDone && <Text style={styles.billCheckMark}>✓</Text>}
              <Text style={[styles.billCheckText, r.billingDone && styles.billCheckTextOn]}>
                請求対応済
              </Text>
            </Pressable>
          )}
          {!readOnly && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                void onDelete();
              }}
              hitSlop={10}
            >
              <Text style={styles.itemDelete}>削除</Text>
            </Pressable>
          )}
          <Text style={styles.itemAmount}>¥{yen(billing.taxIncluded)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [showTypeChooser, setShowTypeChooser] = useState(false);
  const reports = useReportStore((s) => s.reports);
  const isViewer = useIsViewer();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // 会社ごとにグループ化（各グループ内は新しい順）。請求対応済みは月別グループへ
  const { groups, monthGroups } = useMemo(() => {
    const sorted = [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const map = new Map<string, MaintenanceReport[]>();
    const months = new Map<string, { label: string; list: MaintenanceReport[] }>();
    for (const r of sorted) {
      if (r.billingDone) {
        const mk = monthKeyOf(r);
        const g = months.get(mk.sort);
        if (g) g.list.push(r);
        else months.set(mk.sort, { label: mk.label, list: [r] });
        continue;
      }
      const key = r.company || NO_COMPANY;
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return {
      groups: [...map.entries()].sort(([a], [b]) => {
        if (a === NO_COMPANY) return 1;
        if (b === NO_COMPANY) return -1;
        return a.localeCompare(b, 'ja');
      }),
      // 新しい月が上
      monthGroups: [...months.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([sort, g]) => ({ sort, ...g })),
    };
  }, [reports]);

  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  function toggleMonth(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
        <View style={styles.headerRow}>
          <View style={styles.logoWrap}>
            <Image source={logoAsset} style={styles.logo} contentFit="contain" />
          </View>
          <View>
            <Text style={styles.headerTitle}>らくらく店舗メンテナンス</Text>
            <Text style={styles.headerSub}>定期点検・施工記録</Text>
          </View>
        </View>
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
                {isOpen && list.map((r) => <ReportCard key={r.id} r={r} readOnly={isViewer} />)}
              </View>
            );
          })
        )}

        {/* 請求対応済み（月別アーカイブ） */}
        {monthGroups.length > 0 && (
          <>
            <View style={styles.monthDivider}>
              <Text style={styles.monthDividerText}>請求対応済み（月別）</Text>
            </View>
            {monthGroups.map((g) => {
              const isOpen = openMonths.has(g.sort);
              return (
                <View key={g.sort}>
                  <Pressable style={[styles.folder, styles.monthFolder]} onPress={() => toggleMonth(g.sort)}>
                    <Text style={styles.folderCaret}>{isOpen ? '▾' : '▸'}</Text>
                    <Text style={styles.folderName} numberOfLines={1}>
                      {g.label}分
                    </Text>
                    <Text style={styles.folderCount}>{g.list.length}件</Text>
                  </Pressable>
                  {isOpen && g.list.map((r) => <ReportCard key={r.id} r={r} readOnly={isViewer} />)}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {!isViewer && (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          onPress={() => setShowTypeChooser(true)}
        >
          <Text style={styles.fabPlus}>＋</Text>
          <Text style={styles.fabText}>新規作成</Text>
        </Pressable>
      )}

      {/* 新規作成: 報告書の種類を選択 */}
      <Modal
        visible={showTypeChooser}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeChooser(false)}
      >
        <Pressable style={styles.chooserBackdrop} onPress={() => setShowTypeChooser(false)}>
          <View style={styles.chooserSheet}>
            <Text style={styles.chooserTitle}>作成する報告書</Text>
            <Pressable
              style={styles.chooserBtn}
              onPress={() => {
                setShowTypeChooser(false);
                router.push('/report/new');
              }}
            >
              <Text style={styles.chooserBtnTitle}>メンテナンス報告</Text>
              <Text style={styles.chooserBtnSub}>定期点検・害虫駆除・トッピングなど</Text>
            </Pressable>
            <Pressable
              style={[styles.chooserBtn, styles.chooserBtnOrder]}
              onPress={() => {
                setShowTypeChooser(false);
                router.push('/report/new?type=order');
              }}
            >
              <Text style={styles.chooserBtnTitle}>オーダー工事報告</Text>
              <Text style={styles.chooserBtnSub}>工事内容・使用備品資材（写真は任意）</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  orderBadge: { color: '#B25E09', fontSize: 12, fontWeight: '800' },
  billCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#fff',
  },
  billCheckOn: { borderColor: '#1E7B34', backgroundColor: '#E5F5E9' },
  billCheckMark: { fontSize: 12, fontWeight: '900', color: '#1E7B34' },
  billCheckText: { fontSize: 12, fontWeight: '700', color: C.textSub },
  billCheckTextOn: { color: '#1E7B34' },
  monthDivider: {
    marginTop: 18,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  monthDividerText: { fontSize: 13, fontWeight: '800', color: C.textSub },
  monthFolder: { backgroundColor: '#EDF6EF' },
  chooserBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  chooserSheet: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    gap: 10,
    marginBottom: 24,
  },
  chooserTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 },
  chooserBtn: {
    borderWidth: 1.5,
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  chooserBtnOrder: { borderColor: '#E8590C', backgroundColor: '#FFF1E6' },
  chooserBtnTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  chooserBtnSub: { fontSize: 12, color: C.textSub, marginTop: 3 },
  header: {
    backgroundColor: C.headerBg,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 42, height: 42 },
  headerTitle: { color: '#FFF', fontSize: 21, fontWeight: '800' },
  headerSub: { color: '#D8E7FA', fontSize: 13, marginTop: 2 },
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
    borderColor: '#C7DCF7',
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
  itemBottomRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  itemDelete: { fontSize: 13, fontWeight: '600', color: C.danger },
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
