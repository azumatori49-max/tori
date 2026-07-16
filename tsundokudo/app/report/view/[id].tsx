/**
 * レポート閲覧画面（読み取り専用）
 *
 * 店長など閲覧専用アカウント向けの詳細表示。編集はできない。
 * PDF出力・共有は可能。
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { Button, Card, SectionTitle } from '@/components/ui';
import { C } from '@/constants/colors';
import { calcBilling, supplyAmount, yen } from '@/lib/billing';
import { formatWorkDate } from '@/lib/format';
import { exportReportPdf } from '@/lib/exportPdf';
import { pdfBlockReason } from '@/lib/reportValidation';
import { notify } from '@/lib/dialog';
import type { ReportPhoto } from '@/types/report';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

function PhotoStrip({ photos }: { photos: ReportPhoto[] }) {
  if (!photos.length) return null;
  return (
    <View style={styles.photoStrip}>
      {photos.map((p) => (
        <Image key={p.id} source={{ uri: p.uri }} style={styles.photo} contentFit="cover" />
      ))}
    </View>
  );
}

export default function ReportViewScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const report = useReportStore((s) => s.reports.find((r) => r.id === params.id));

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/reports');
  }

  if (!report) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.notFound}>レポートが見つかりません</Text>
        <View style={{ height: 12 }} />
        <Button title="一覧へ戻る" variant="ghost" onPress={goBack} />
      </View>
    );
  }

  const billing = calcBilling(report);
  const checkedItems = report.checklist.filter((c) => c.checked);
  const pest = report.pestControl;
  const pestLabels = [
    pest.basic ? '基本駆除' : '',
    pest.antiDrug ? '対抗薬剤使用' : '',
    pest.strongPesticide ? '強殺虫剤' : '',
  ].filter(Boolean);
  const toppings = report.toppings.filter((t) => t.checked);

  async function onExport() {
    try {
      if (!report) return;
      const reason = pdfBlockReason(report);
      if (reason) {
        notify('PDFに変換できません', `未完成の項目があります。\n${reason}`);
        return;
      }
      const res = await exportReportPdf(report);
      if (res.message) notify('PDF', res.message);
    } catch (e) {
      notify('PDF出力に失敗しました', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={10}>
          <Text style={styles.topbarBtn}>‹ 戻る</Text>
        </Pressable>
        <Text style={styles.topbarTitle} numberOfLines={1}>
          {report.storeName || 'レポート'}
        </Text>
        <View style={styles.viewBadge}>
          <Text style={styles.viewBadgeText}>閲覧</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* 基本情報 */}
        <SectionTitle>基本情報</SectionTitle>
        <Card>
          <Row label="施工店舗" value={report.storeName} />
          <Row label="会社名" value={report.company} />
          <Row label="施工日" value={formatWorkDate(report.workDate)} />
          <Row label="契約プラン" value={report.contractPlan} />
          <Row label="施工担当者" value={report.technician} />
          <Row label="御請求先" value={report.billingTo} />
        </Card>

        {/* 請求 */}
        <SectionTitle>ご請求金額</SectionTitle>
        <Card>
          <Row label="メンテナンス" value={`¥${yen(billing.maintenance)}`} />
          <Row label="トッピング" value={`¥${yen(billing.toppings)}`} />
          <Row label="プチDIY" value={`¥${yen(billing.diy)}`} />
          <Row label="年間スケジュール" value={`¥${yen(billing.annual)}`} />
          <Row label="備品 資材 廃棄" value={`¥${yen(billing.supplies)}`} />
          <Row label="小計（税抜）" value={`¥${yen(billing.taxExcluded)}`} />
          <Row label="消費税" value={`¥${yen(billing.tax)}`} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ご請求金額（税込）</Text>
            <Text style={styles.totalValue}>¥{yen(billing.taxIncluded)}</Text>
          </View>
        </Card>

        {/* 定期点検 */}
        <SectionTitle>
          定期点検（実施 {checkedItems.length}/{report.checklist.length}）
        </SectionTitle>
        {report.checklist.map((c) => (
          <Card key={c.name}>
            <View style={styles.checkHead}>
              <Text style={[styles.checkMark, !c.checked && styles.checkMarkOff]}>
                {c.checked ? '✓' : '－'}
              </Text>
              <Text style={styles.checkName}>{c.name}</Text>
              {c.condition ? (
                <Text
                  style={[
                    styles.condPill,
                    c.condition === 'できてない' && styles.condPillAlert,
                  ]}
                >
                  {c.condition}
                </Text>
              ) : null}
            </View>
            {c.subChecks ? (
              <Text style={styles.subChecksLine}>
                {c.subChecks.map((sc) => `${sc.checked ? '✓' : '－'} ${sc.name}`).join('　')}
              </Text>
            ) : null}
            {c.note ? <Text style={styles.note}>{c.note}</Text> : null}
            <PhotoStrip photos={c.photos} />
          </Card>
        ))}

        {/* 害虫駆除 */}
        <SectionTitle>害虫駆除</SectionTitle>
        <Card>
          <Row label="実施内容" value={pestLabels.join('、')} />
          <Row label="害虫の状況" value={pest.presence} />
          <PhotoStrip photos={pest.photos} />
        </Card>

        {/* トッピング */}
        <SectionTitle>トッピング（追加施工）</SectionTitle>
        <Card>
          {toppings.length === 0 ? (
            <Text style={styles.empty}>なし</Text>
          ) : (
            toppings.map((t, i) => (
              <View key={i} style={styles.subBlock}>
                <View style={styles.subHead}>
                  <Text style={styles.subName}>{t.name || '（名称なし）'}</Text>
                  {t.fee ? <Text style={styles.subFee}>¥{yen(t.fee)}</Text> : null}
                </View>
                {t.comment ? <Text style={styles.note}>{t.comment}</Text> : null}
              </View>
            ))
          )}
        </Card>

        {/* プチDIY */}
        <SectionTitle>プチDIY</SectionTitle>
        <Card>
          {report.diy.length === 0 ? (
            <Text style={styles.empty}>なし</Text>
          ) : (
            report.diy.map((d, i) => (
              <View key={i} style={styles.subBlock}>
                <View style={styles.subHead}>
                  <Text style={styles.subName}>{d.name || '（名称なし）'}</Text>
                  {d.fee ? <Text style={styles.subFee}>¥{yen(d.fee)}</Text> : null}
                </View>
                {d.comment ? <Text style={styles.note}>{d.comment}</Text> : null}
                <PhotoStrip photos={d.photos} />
              </View>
            ))
          )}
        </Card>

        {/* 備品資材 */}
        <SectionTitle>使用備品資材</SectionTitle>
        <Card>
          {report.supplies.length === 0 ? (
            <Text style={styles.empty}>なし</Text>
          ) : (
            <>
              {report.supplies.map((s, i) => (
                <View key={i} style={styles.supplyRow}>
                  <Text style={styles.supplyName}>{s.name || '—'}</Text>
                  <Text style={styles.supplyDetail}>
                    ¥{yen(s.unitPrice)} × {s.qty} ＝ ¥{yen(supplyAmount(s))}
                  </Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>合計</Text>
                <Text style={styles.totalValue}>¥{yen(billing.supplies)}</Text>
              </View>
            </>
          )}
        </Card>

        {/* 年間スケジュール */}
        <SectionTitle>年間スケジュール</SectionTitle>
        <Card>
          <Text style={report.annualSchedule.comment ? styles.note : styles.empty}>
            {report.annualSchedule.comment || 'なし'}
          </Text>
          {report.annualSchedule.fee ? (
            <Row label="追加費用" value={`¥${yen(report.annualSchedule.fee)}`} />
          ) : null}
          <PhotoStrip photos={report.annualSchedule.photos} />
        </Card>

        {/* コメント */}
        <SectionTitle>コメント・提案</SectionTitle>
        <Card>
          <Text style={report.comment ? styles.note : styles.empty}>
            {report.comment || 'なし'}
          </Text>
        </Card>

        {/* 写真（全体） */}
        {report.photos.length > 0 && (
          <>
            <SectionTitle>写真</SectionTitle>
            <Card>
              <PhotoStrip photos={report.photos} />
            </Card>
          </>
        )}

        <View style={styles.actions}>
          <Button title="PDF出力・共有" onPress={() => void onExport()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFound: { fontSize: 15, color: C.textSub },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: C.headerBg,
    gap: 10,
  },
  topbarBtn: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  topbarTitle: { color: '#FFF', fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  viewBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  viewBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowLabel: { fontSize: 13, color: C.textSub, flexShrink: 0 },
  rowValue: { fontSize: 14, color: C.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: C.primary,
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: C.primaryDark },
  totalValue: { fontSize: 20, fontWeight: '900', color: C.primary },
  checkHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accent,
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
  },
  checkMarkOff: { backgroundColor: C.border, color: C.textSub },
  checkName: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  condPill: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textSub,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  condPillAlert: { backgroundColor: C.danger, color: '#FFF' },
  note: { fontSize: 13, color: '#475569', marginTop: 8, lineHeight: 19 },
  subChecksLine: { fontSize: 12, color: '#475569', marginTop: 6 },
  empty: { fontSize: 13, color: C.textFaint },
  subBlock: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  subHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subName: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  subFee: { fontSize: 14, fontWeight: '800', color: C.primaryDark },
  supplyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 10,
  },
  supplyName: { fontSize: 14, fontWeight: '600', color: C.text, flex: 1 },
  supplyDetail: { fontSize: 13, color: C.textSub },
  photoStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  photo: { width: 76, height: 76, borderRadius: 8, backgroundColor: C.border },
  actions: { marginHorizontal: 12, marginTop: 16 },
});
