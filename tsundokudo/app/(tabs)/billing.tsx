/**
 * 請求タブ
 * - 会社名・施工日範囲・施工担当者でレポートを絞り込み
 * - まとめてPDF出力（1ファイルに連結・レポートごとに改ページ）
 * - 請求情報のCSVダウンロード
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { useIsViewer } from '@/store/authStore';
import { calcBilling, yen } from '@/lib/billing';
import { exportReportsPdf } from '@/lib/exportPdf';
import { downloadReportsCsv } from '@/lib/exportCsv';
import { pdfBlockReason } from '@/lib/reportValidation';
import { formatWorkDate } from '@/lib/format';
import { confirmAsync, notify } from '@/lib/dialog';
import { Button, Card, SectionTitle } from '@/components/ui';
import { DatePicker } from '@/components/report/DatePicker';
import { C } from '@/constants/colors';
import type { MaintenanceReport } from '@/types/report';

const ALL = 'すべて';

/** レポートの施工日を比較用の YYYY-MM-DD にする（無ければ作成日） */
function reportDateKey(r: MaintenanceReport): string {
  const iso = r.workDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso?.[1] && iso[2] && iso[3]) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }
  const md = r.workDate.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (md?.[1] && md[2]) {
    return `${r.createdAt.slice(0, 4)}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`;
  }
  return r.createdAt.slice(0, 10);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 先月・今月の範囲（YYYY-MM-DD） */
function monthRange(offset: 0 | -1): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset; // 0-based
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  return {
    from: `${first.getFullYear()}-${pad2(first.getMonth() + 1)}-01`,
    to: `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(last.getDate())}`,
  };
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const reports = useReportStore((s) => s.reports);
  const settings = useReportStore((s) => s.settings);
  const isViewer = useIsViewer();

  const lastMonth = monthRange(-1);
  const [company, setCompany] = useState(ALL);
  const [technician, setTechnician] = useState(ALL);
  const [from, setFrom] = useState(lastMonth.from);
  const [to, setTo] = useState(lastMonth.to);
  const [busy, setBusy] = useState(false);

  // 絞り込み（施工日昇順で表示）
  const matched = useMemo(() => {
    return reports
      .filter((r) => {
        if (company !== ALL && (r.company || '未分類') !== company) return false;
        if (technician !== ALL && !r.technician.includes(technician)) return false;
        const d = reportDateKey(r);
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .sort((a, b) => reportDateKey(a).localeCompare(reportDateKey(b)));
  }, [reports, company, technician, from, to]);

  const total = useMemo(
    () => matched.reduce((sum, r) => sum + calcBilling(r).taxIncluded, 0),
    [matched],
  );

  const companies = [ALL, ...settings.companies];
  const technicians = [ALL, ...settings.technicians];
  const rangeLabel = `${from || '…'}〜${to || '…'}`;

  async function onBulkPdf() {
    if (matched.length === 0) return;
    setBusy(true);
    try {
      // 未完成（写真不足など）のレポートは確認のうえ除外して出力
      const incomplete = matched.filter((r) => pdfBlockReason(r) !== null);
      let targets = matched;
      if (incomplete.length > 0) {
        const okGo = await confirmAsync(
          '未完成のレポートがあります',
          `写真などが未完成のレポートが${incomplete.length}件あります。\nこれらを除いた${matched.length - incomplete.length}件をPDF出力しますか？`,
          '除いて出力',
        );
        if (!okGo) return;
        targets = matched.filter((r) => pdfBlockReason(r) === null);
        if (targets.length === 0) {
          notify('出力できるレポートがありません', '各レポートの写真などを完成させてください。');
          return;
        }
      }
      const res = await exportReportsPdf(targets, `メンテナンス報告書まとめ_${from}_${to}`);
      if (res.message) notify('PDF', res.message);
    } catch (e) {
      notify('PDF出力に失敗しました', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onCsv() {
    const res = downloadReportsCsv(matched, `請求明細_${from}_${to}`);
    if (res.message) notify('CSV', res.message);
  }

  if (isViewer) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyText}>このページは閲覧専用アカウントでは使えません</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>請求</Text>
        <Text style={styles.headerSub}>レポートの絞り込み・まとめてPDF・CSV</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <SectionTitle>絞り込み</SectionTitle>
        <Card>
          <Text style={styles.fLabel}>施工日（範囲）</Text>
          <View style={styles.quickRow}>
            <Chip
              label="先月"
              active={from === lastMonth.from && to === lastMonth.to}
              onPress={() => {
                setFrom(lastMonth.from);
                setTo(lastMonth.to);
              }}
            />
            <Chip
              label="今月"
              active={from === monthRange(0).from && to === monthRange(0).to}
              onPress={() => {
                const cur = monthRange(0);
                setFrom(cur.from);
                setTo(cur.to);
              }}
            />
            <Chip
              label="全期間"
              active={!from && !to}
              onPress={() => {
                setFrom('');
                setTo('');
              }}
            />
          </View>
          <View style={styles.rangeRow}>
            <View style={{ flex: 1 }}>
              <DatePicker value={from} onChange={setFrom} />
            </View>
            <Text style={styles.rangeTilde}>〜</Text>
            <View style={{ flex: 1 }}>
              <DatePicker value={to} onChange={setTo} />
            </View>
          </View>

          <Text style={styles.fLabel}>会社名</Text>
          <View style={styles.chipWrap}>
            {companies.map((c) => (
              <Chip key={c} label={c} active={company === c} onPress={() => setCompany(c)} />
            ))}
          </View>

          <Text style={styles.fLabel}>施工担当者</Text>
          <View style={styles.chipWrap}>
            {technicians.map((t) => (
              <Chip key={t} label={t} active={technician === t} onPress={() => setTechnician(t)} />
            ))}
          </View>
        </Card>

        <SectionTitle>
          結果 {matched.length}件（{rangeLabel}）
        </SectionTitle>
        <Card>
          {matched.length === 0 ? (
            <Text style={styles.emptyText}>条件に合うレポートがありません</Text>
          ) : (
            <>
              {matched.map((r) => (
                <Pressable
                  key={r.id}
                  style={styles.row}
                  onPress={() => router.push(`/report/${r.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowStore} numberOfLines={1}>
                      {r.reportType === 'order' && (
                        <Text style={styles.orderBadge}>オーダー工事　</Text>
                      )}
                      {r.storeName || '（店舗未設定）'}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {formatWorkDate(r.workDate) || '日付未設定'}
                      {r.company ? `　${r.company}` : ''}
                      {r.technician ? `　${r.technician}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.rowAmount}>¥{yen(calcBilling(r).taxIncluded)}</Text>
                </Pressable>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>合計（税込）</Text>
                <Text style={styles.totalVal}>¥{yen(total)}</Text>
              </View>
            </>
          )}
        </Card>

        <View style={styles.actions}>
          <Button
            title={busy ? '出力中…' : `まとめてPDF出力（${matched.length}件）`}
            onPress={() => void onBulkPdf()}
          />
          <View style={{ height: 10 }} />
          <Button title="CSVダウンロード（請求明細）" variant="ghost" onPress={onCsv} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    backgroundColor: C.headerBg,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  headerSub: { color: '#CFE0F5', fontSize: 12, marginTop: 2 },
  fLabel: { fontSize: 12, fontWeight: '700', color: C.textSub, marginTop: 14, marginBottom: 6 },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeTilde: { color: C.textSub, fontSize: 15 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipOn: { borderColor: C.primary, backgroundColor: C.primaryLight },
  chipText: { fontSize: 13, fontWeight: '600', color: C.textSub },
  chipTextOn: { color: C.primaryDark },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowStore: { fontSize: 14.5, fontWeight: '700', color: C.text },
  rowMeta: { fontSize: 12, color: C.textSub, marginTop: 2 },
  rowAmount: { fontSize: 14.5, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
  orderBadge: { color: '#B25E09', fontSize: 11.5, fontWeight: '800' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: C.primaryDark },
  totalVal: { fontSize: 18, fontWeight: '900', color: C.primaryDark },
  actions: { paddingHorizontal: 16, marginTop: 18 },
  emptyText: { fontSize: 13.5, color: C.textFaint, paddingVertical: 8 },
});
