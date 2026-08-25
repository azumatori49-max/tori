/**
 * ネズミ駆除契約の作成・編集
 * - 契約情報（店舗・坪数→料金自動表示・開始日→満了日自動計算）
 * - 契約更新（6ヶ月/1年/2年の延長）
 * - 毎月の点検履歴（日付・作業内容・発生状況・写真無制限）
 */
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRatStore } from '@/store/ratStore';
import { useReportStore } from '@/store/reportStore';
import { useIsViewer } from '@/store/authStore';
import { addMonths, ratPricing, ratStatus, todayIso } from '@/lib/ratPlan';
import { yen } from '@/lib/billing';
import { confirmAsync, notify } from '@/lib/dialog';
import { Button, Card, ChipSelect, Field, Input, SectionTitle } from '@/components/ui';
import { DatePicker } from '@/components/report/DatePicker';
import { PhotoSection } from '@/components/report/PhotoSection';
import { PEST_PRESENCE_OPTIONS } from '@/constants/hygiene';
import { C } from '@/constants/colors';
import type { RatContractInsert, RatVisit } from '@/types/rat';
import type { PestPresence, ReportPhoto } from '@/types/report';

/** 契約用の日付表示（年付き: 2026/8/25） */
function fmtDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return iso;
  return `${m[1]}/${Number(m[2])}/${Number(m[3])}`;
}

function toNum(v: string): number {
  return Number(v.replace(/[^0-9]/g, '')) || 0;
}

function newVisitId(): string {
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export default function RatContractScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const isNew = id === 'new';
  const isViewer = useIsViewer();

  const store = useRatStore();
  const stores = useReportStore((s) => s.settings.stores);
  const existing = isNew ? undefined : store.getContract(id);

  const [form, setForm] = useState<RatContractInsert>(() => {
    if (existing) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = existing;
      void _i;
      void _c;
      void _u;
      return rest;
    }
    return {
      storeName: '',
      tsubo: 0,
      startDate: '',
      endDate: '',
      renewals: [],
      note: '',
      visits: [],
    };
  });

  // 点検の追加フォーム
  const [visitDate, setVisitDate] = useState(todayIso());
  const [visitWork, setVisitWork] = useState('');
  const [visitPresence, setVisitPresence] = useState<PestPresence | ''>('');
  const [visitPhotos, setVisitPhotos] = useState<ReportPhoto[]>([]);

  const price = useMemo(() => ratPricing(form.tsubo), [form.tsubo]);
  const status = form.endDate ? ratStatus(form) : null;

  if (isViewer) {
    return <Redirect href="/(tabs)/rat" />;
  }

  function patch(p: Partial<RatContractInsert>) {
    setForm((f) => ({ ...f, ...p }));
  }

  /** 開始日を選ぶと満了日を1年後に自動設定（未更新の契約のみ） */
  function applyStartDate(iso: string) {
    setForm((f) => ({
      ...f,
      startDate: iso,
      endDate: f.renewals.length === 0 ? addMonths(iso, 12) : f.endDate,
    }));
  }

  function addVisit() {
    if (!visitDate) {
      notify('点検日を選択してください');
      return;
    }
    const visit: RatVisit = {
      id: newVisitId(),
      date: visitDate,
      work: visitWork.trim(),
      presence: visitPresence,
      photos: visitPhotos,
    };
    setForm((f) => ({ ...f, visits: [visit, ...f.visits] }));
    setVisitDate(todayIso());
    setVisitWork('');
    setVisitPresence('');
    setVisitPhotos([]);
  }

  function removeVisit(visitId: string) {
    setForm((f) => ({ ...f, visits: f.visits.filter((v) => v.id !== visitId) }));
  }

  async function renew(months: number) {
    const label = months === 12 ? '1年' : months === 24 ? '2年' : `${months}ヶ月`;
    const nextEnd = addMonths(form.endDate, months);
    const ok = await confirmAsync(
      '契約を更新',
      `満了日を${label}延長します。\n${fmtDate(form.endDate)} → ${fmtDate(nextEnd)}`,
      '更新する',
    );
    if (!ok) return;
    patch({
      endDate: nextEnd,
      renewals: [...form.renewals, { date: todayIso(), months }],
    });
    notify('更新しました', '「保存」を押すと確定します。');
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/rat');
  }

  async function onSave() {
    if (!form.storeName.trim()) {
      notify('店舗名を入力してください');
      return;
    }
    if (!form.startDate) {
      notify('契約開始日を選択してください');
      return;
    }
    const ok = isNew
      ? await store.createContract(form)
      : await store.updateContract(id, form);
    if (ok) goBack();
    else notify('保存できませんでした', useRatStore.getState().error ?? '');
  }

  async function onDelete() {
    const ok = await confirmAsync('契約を削除', 'この操作は取り消せません。', '削除');
    if (!ok) return;
    const done = await store.deleteContract(id);
    if (done) goBack();
    else notify('削除できませんでした', useRatStore.getState().error ?? '');
  }

  const sortedVisits = [...form.visits].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <View style={styles.root}>
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={10}>
          <Text style={styles.topbarBtn}>‹ 戻る</Text>
        </Pressable>
        <Text style={styles.topbarTitle}>{isNew ? '新規ネズミ駆除契約' : 'ネズミ駆除契約'}</Text>
        <Pressable onPress={() => void onSave()} hitSlop={10}>
          <Text style={[styles.topbarBtn, styles.topbarSave]}>保存</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {status && (
            <View
              style={[
                styles.statusBand,
                status.key === 'active' && styles.statusActive,
                status.key === 'expiring' && styles.statusExpiring,
                status.key === 'expired' && styles.statusExpired,
              ]}
            >
              <Text style={styles.statusText}>
                {status.label}
                {status.key === 'expired'
                  ? `（満了から${-status.daysLeft}日経過）`
                  : `（満了まで残り${status.daysLeft}日）`}
              </Text>
            </View>
          )}

          <SectionTitle>契約情報</SectionTitle>
          <Card>
            <Field label="店舗名">
              <Input
                value={form.storeName}
                onChangeText={(v) => patch({ storeName: v })}
                placeholder="例: 鶏ヤロー　柏店"
              />
              <View style={{ height: 8 }} />
              <ChipSelect
                options={stores}
                value={form.storeName}
                onChange={(v) => patch({ storeName: v })}
              />
            </Field>
            <Field label="坪数">
              <Input
                value={form.tsubo ? String(form.tsubo) : ''}
                onChangeText={(v) => patch({ tsubo: toNum(v) })}
                placeholder="例: 25"
                keyboardType="number-pad"
              />
            </Field>

            {/* 料金の自動表示 */}
            <View style={styles.priceBox}>
              {price ? (
                <>
                  <Text style={styles.priceTier}>{price.tier}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>初回施工費（税抜）</Text>
                    <Text style={styles.priceVal}>¥{yen(price.initialFee)}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>月額料金（税抜）</Text>
                    <Text style={styles.priceVal}>¥{yen(price.monthlyFee)}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.priceNote}>
                  {form.tsubo > 100
                    ? '100坪を超える場合は個別見積です'
                    : '坪数を入力すると料金が自動表示されます'}
                </Text>
              )}
            </View>

            <Field label="契約開始日（1年契約）">
              <DatePicker value={form.startDate} onChange={applyStartDate} />
            </Field>
            <Field label="契約満了日（自動計算）">
              <View style={styles.endDateBox}>
                <Text style={styles.endDateText}>
                  {form.endDate ? fmtDate(form.endDate) : '開始日を選ぶと自動設定されます'}
                </Text>
              </View>
            </Field>
            <Field label="メモ（侵入口の場所など）">
              <Input value={form.note} onChangeText={(v) => patch({ note: v })} multiline />
            </Field>
          </Card>

          {/* 契約更新 */}
          {!isNew && form.endDate !== '' && (
            <>
              <SectionTitle>契約更新</SectionTitle>
              <Card>
                <Text style={styles.hint}>
                  更新すると満了日が延長されます（更新履歴も残ります）。
                </Text>
                <View style={styles.renewRow}>
                  <Button title="＋6ヶ月" variant="ghost" onPress={() => void renew(6)} />
                  <Button title="＋1年" onPress={() => void renew(12)} />
                  <Button title="＋2年" variant="ghost" onPress={() => void renew(24)} />
                </View>
                {form.renewals.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    {form.renewals.map((r, i) => (
                      <Text key={i} style={styles.renewLog}>
                        ・{fmtDate(r.date)} に {r.months}ヶ月更新
                      </Text>
                    ))}
                  </View>
                )}
              </Card>
            </>
          )}

          {/* 点検履歴 */}
          <SectionTitle>毎月の点検</SectionTitle>
          <Card>
            <Text style={styles.hint}>
              点検・ベイト交換・トラップ設置・侵入口チェックの記録を追加してください。
            </Text>
            <Field label="点検日">
              <DatePicker value={visitDate} onChange={setVisitDate} />
            </Field>
            <Field label="作業内容">
              <Input
                value={visitWork}
                onChangeText={setVisitWork}
                placeholder="例: ベイト交換、トラップ2箇所設置、侵入口異常なし"
                multiline
              />
            </Field>
            <Field label="発生状況">
              <ChipSelect
                options={[...PEST_PRESENCE_OPTIONS]}
                value={visitPresence}
                allowEmpty={false}
                onChange={(v) => setVisitPresence(v as PestPresence | '')}
              />
            </Field>
            <Text style={styles.subLabel}>写真（枚数無制限）</Text>
            <PhotoSection photos={visitPhotos} onChange={setVisitPhotos} defaultCategory="施工後" />
            <View style={{ height: 10 }} />
            <Button title="＋ 点検を追加" variant="ghost" onPress={addVisit} />
          </Card>

          {sortedVisits.length > 0 && (
            <>
              <SectionTitle>点検履歴（{sortedVisits.length}回）</SectionTitle>
              {sortedVisits.map((v) => (
                <Card key={v.id}>
                  <View style={styles.visitHead}>
                    <Text style={styles.visitDate}>{fmtDate(v.date)}</Text>
                    {v.presence !== '' && (
                      <Text
                        style={[
                          styles.visitPresence,
                          v.presence === '多い' && styles.presenceBad,
                        ]}
                      >
                        {v.presence}
                      </Text>
                    )}
                    <Pressable onPress={() => removeVisit(v.id)} hitSlop={8}>
                      <Text style={styles.visitRemove}>削除</Text>
                    </Pressable>
                  </View>
                  {v.work !== '' && <Text style={styles.visitWork}>{v.work}</Text>}
                  {v.photos.length > 0 && (
                    <PhotoSection
                      photos={v.photos}
                      onChange={(photos) =>
                        setForm((f) => ({
                          ...f,
                          visits: f.visits.map((x) => (x.id === v.id ? { ...x, photos } : x)),
                        }))
                      }
                    />
                  )}
                </Card>
              ))}
            </>
          )}

          <View style={styles.actions}>
            <Button title={isNew ? '契約を保存' : '変更を保存'} onPress={() => void onSave()} />
            {!isNew && (
              <>
                <View style={{ height: 10 }} />
                <Button title="契約を削除" variant="danger" onPress={() => void onDelete()} />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topbar: {
    backgroundColor: C.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topbarBtn: { color: '#DCE9FA', fontSize: 15, fontWeight: '700' },
  topbarSave: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  topbarTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  statusBand: { marginHorizontal: 14, marginTop: 12, borderRadius: 12, padding: 12 },
  statusActive: { backgroundColor: '#E5F5E9' },
  statusExpiring: { backgroundColor: '#FFF3D6' },
  statusExpired: { backgroundColor: '#FDECEC' },
  statusText: { fontSize: 14, fontWeight: '800', color: C.text, textAlign: 'center' },
  priceBox: {
    backgroundColor: C.primaryLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  priceTier: { fontSize: 12, fontWeight: '800', color: C.primaryDark, marginBottom: 6 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  priceLabel: { fontSize: 13, color: C.textSub },
  priceVal: { fontSize: 14, fontWeight: '800', color: C.primaryDark },
  priceNote: { fontSize: 12.5, color: C.textSub },
  endDateBox: {
    backgroundColor: '#F1F5FB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  endDateText: { fontSize: 15, fontWeight: '700', color: C.text },
  hint: { fontSize: 12, color: C.textFaint, marginBottom: 10, lineHeight: 17 },
  renewRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  renewLog: { fontSize: 12.5, color: C.textSub, paddingVertical: 2 },
  subLabel: { fontSize: 12, fontWeight: '600', color: C.textSub, marginBottom: 6, marginTop: 10 },
  visitHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  visitDate: { flex: 1, fontSize: 15, fontWeight: '800', color: C.text },
  visitPresence: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E7B34',
    backgroundColor: '#E5F5E9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  presenceBad: { color: '#C0392B', backgroundColor: '#FDECEC' },
  visitRemove: { color: C.danger, fontSize: 12.5, fontWeight: '700' },
  visitWork: { fontSize: 13.5, color: C.textSub, marginTop: 8, lineHeight: 19 },
  actions: { paddingHorizontal: 16, marginTop: 18 },
});
