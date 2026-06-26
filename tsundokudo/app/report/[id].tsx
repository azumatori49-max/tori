/**
 * メンテナンスレポート 入力フォーム（新規 / 編集 兼用）
 *
 * ルート:
 *   /report/new   … 新規作成（任意で ?store= で店舗を初期指定）
 *   /report/:id   … 既存レポートの編集
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { Button, Card, CheckBox, ChipSelect, Field, Input, SectionTitle } from '@/components/ui';
import { CONDITION_OPTIONS } from '@/constants/hygiene';
import { C } from '@/constants/colors';
import { calcBilling, supplyAmount, yen } from '@/lib/billing';
import type {
  ChecklistItem,
  MaintenanceReportInsert,
  SupplyLine,
  ToppingItem,
} from '@/types/report';

function toNum(v: string): number {
  return Number(v.replace(/[^0-9]/g, '')) || 0;
}

export default function ReportFormScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; store?: string }>();
  const id = params.id;
  const isNew = id === 'new';

  const store = useReportStore();
  const existing = isNew ? undefined : store.getReport(id);

  // 作業中のフォーム状態（保存するまでストアには反映しない）
  const [form, setForm] = useState<MaintenanceReportInsert>(() => {
    if (existing) {
      // id / createdAt / updatedAt はフォームでは編集しないため除外
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = existing;
      void _id;
      void _createdAt;
      void _updatedAt;
      return rest;
    }
    const draft = store.draftReport();
    if (params.store) draft.storeName = params.store;
    return draft;
  });

  const billing = useMemo(() => calcBilling(form), [form]);

  function patch(p: Partial<MaintenanceReportInsert>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function patchChecklist(idx: number, p: Partial<ChecklistItem>) {
    setForm((f) => ({
      ...f,
      checklist: f.checklist.map((c, i) => (i === idx ? { ...c, ...p } : c)),
    }));
  }

  function patchTopping(idx: number, p: Partial<ToppingItem>) {
    setForm((f) => ({
      ...f,
      toppings: f.toppings.map((t, i) => (i === idx ? { ...t, ...p } : t)),
    }));
  }

  function patchSupply(idx: number, p: Partial<SupplyLine>) {
    setForm((f) => ({
      ...f,
      supplies: f.supplies.map((s, i) => (i === idx ? { ...s, ...p } : s)),
    }));
  }

  function addSupply() {
    setForm((f) => ({
      ...f,
      supplies: [...f.supplies, { name: '', unitPrice: 0, qty: 1 }],
    }));
  }

  function removeSupply(idx: number) {
    setForm((f) => ({ ...f, supplies: f.supplies.filter((_, i) => i !== idx) }));
  }

  function onSave() {
    if (!form.storeName.trim()) {
      Alert.alert('店舗名を入力してください');
      return;
    }
    if (isNew) {
      store.createReport(form);
    } else {
      store.updateReport(id, form);
    }
    router.back();
  }

  function onDelete() {
    Alert.alert('レポートを削除', 'この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          store.deleteReport(id);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      {/* ヘッダーバー */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.topbarBtn}>‹ 戻る</Text>
        </Pressable>
        <Text style={styles.topbarTitle}>{isNew ? '新規レポート' : 'レポート編集'}</Text>
        <Pressable onPress={onSave} hitSlop={10}>
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
          {/* ── 基本情報 ── */}
          <SectionTitle>基本情報</SectionTitle>
          <Card>
            <Field label="作業店舗">
              <Input
                value={form.storeName}
                onChangeText={(v) => patch({ storeName: v })}
                placeholder="例: まる助東松山駅前店"
              />
              <View style={{ height: 8 }} />
              <ChipSelect
                options={store.settings.stores}
                value={form.storeName}
                onChange={(v) => patch({ storeName: v })}
              />
            </Field>
            <Field label="作業日">
              <Input
                value={form.workDate}
                onChangeText={(v) => patch({ workDate: v })}
                placeholder="例: 5/15 または 2026-05-15"
              />
            </Field>
            <Field label="契約プラン">
              <Input
                value={form.contractPlan}
                onChangeText={(v) => patch({ contractPlan: v })}
                placeholder="例: メンテナンス"
              />
            </Field>
            <Field label="施工担当者">
              <Input
                value={form.technician}
                onChangeText={(v) => patch({ technician: v })}
                placeholder="例: 佐藤　真人"
              />
              <View style={{ height: 8 }} />
              <ChipSelect
                options={store.settings.technicians}
                value={form.technician}
                onChange={(v) => patch({ technician: v })}
              />
            </Field>
            <Field label="御請求先">
              <Input
                value={form.billingTo}
                onChangeText={(v) => patch({ billingTo: v })}
                multiline
              />
            </Field>
          </Card>

          {/* ── 請求サマリ（自動計算） ── */}
          <SectionTitle>請求額（自動計算）</SectionTitle>
          <Card>
            <Field label="メンテナンス料金（税抜・円）">
              <Input
                value={String(form.maintenanceFee)}
                onChangeText={(v) => patch({ maintenanceFee: toNum(v) })}
                keyboardType="number-pad"
              />
            </Field>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>メンテナンス</Text>
              <Text style={styles.billVal}>¥{yen(billing.maintenance)}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>トッピング</Text>
              <Text style={styles.billVal}>¥{yen(billing.toppings)}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>備品 資材 廃棄</Text>
              <Text style={styles.billVal}>¥{yen(billing.supplies)}</Text>
            </View>
            <View style={[styles.billRow, styles.billDivider]}>
              <Text style={styles.billLabel}>税抜き</Text>
              <Text style={styles.billVal}>¥{yen(billing.taxExcluded)}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>消費税（10%）</Text>
              <Text style={styles.billVal}>¥{yen(billing.tax)}</Text>
            </View>
            <View style={[styles.billRow, styles.billTotal]}>
              <Text style={styles.billTotalLabel}>請求額（税込）</Text>
              <Text style={styles.billTotalVal}>¥{yen(billing.taxIncluded)}</Text>
            </View>
          </Card>

          {/* ── 定期点検 ── */}
          <SectionTitle>定期点検</SectionTitle>
          {form.checklist.map((item, idx) => (
            <Card key={item.name}>
              <CheckBox
                checked={item.checked}
                onToggle={() => patchChecklist(idx, { checked: !item.checked })}
                label={item.name}
              />
              {item.checked && (
                <View style={styles.checklistBody}>
                  <Text style={styles.subLabel}>状況</Text>
                  <ChipSelect
                    options={CONDITION_OPTIONS}
                    value={item.condition}
                    onChange={(v) => patchChecklist(idx, { condition: v as ChecklistItem['condition'] })}
                  />
                  <View style={{ height: 8 }} />
                  <Input
                    value={item.note}
                    onChangeText={(v) => patchChecklist(idx, { note: v })}
                    placeholder="備考"
                  />
                  <View style={{ height: 8 }} />
                  <Input
                    value={item.nextDate}
                    onChangeText={(v) => patchChecklist(idx, { nextDate: v })}
                    placeholder="次回作業予定日（例: 6/14）"
                  />
                </View>
              )}
            </Card>
          ))}

          {/* ── 害虫駆除 ── */}
          <SectionTitle>害虫駆除</SectionTitle>
          <Card>
            <View style={styles.pestRow}>
              <CheckBox
                checked={form.pestControl.basic}
                onToggle={() =>
                  patch({ pestControl: { ...form.pestControl, basic: !form.pestControl.basic } })
                }
                label="基本駆除"
              />
            </View>
            <View style={styles.pestRow}>
              <CheckBox
                checked={form.pestControl.antiDrug}
                onToggle={() =>
                  patch({
                    pestControl: { ...form.pestControl, antiDrug: !form.pestControl.antiDrug },
                  })
                }
                label="対抗薬剤使用"
              />
            </View>
            <View style={styles.pestRow}>
              <CheckBox
                checked={form.pestControl.strongPesticide}
                onToggle={() =>
                  patch({
                    pestControl: {
                      ...form.pestControl,
                      strongPesticide: !form.pestControl.strongPesticide,
                    },
                  })
                }
                label="強殺虫剤"
              />
            </View>
          </Card>

          {/* ── トッピング ── */}
          <SectionTitle>トッピング（追加作業）</SectionTitle>
          {form.toppings.map((t, idx) => (
            <Card key={t.name}>
              <CheckBox
                checked={t.checked}
                onToggle={() => patchTopping(idx, { checked: !t.checked })}
                label={t.name}
              />
              {t.checked && (
                <View style={styles.checklistBody}>
                  <Input
                    value={t.comment}
                    onChangeText={(v) => patchTopping(idx, { comment: v })}
                    placeholder="コメント"
                  />
                  <View style={{ height: 8 }} />
                  <Field label="追加費用（税抜・円）">
                    <Input
                      value={String(t.fee)}
                      onChangeText={(v) => patchTopping(idx, { fee: toNum(v) })}
                      keyboardType="number-pad"
                    />
                  </Field>
                </View>
              )}
            </Card>
          ))}

          {/* ── 備品資材 ── */}
          <SectionTitle>使用備品資材</SectionTitle>
          <Card>
            {form.supplies.length === 0 && (
              <Text style={styles.emptyLine}>明細はありません</Text>
            )}
            {form.supplies.map((s, idx) => (
              <View key={idx} style={styles.supplyRow}>
                <Input
                  value={s.name}
                  onChangeText={(v) => patchSupply(idx, { name: v })}
                  placeholder="品目（例: ゴミ回収 3立米）"
                  style={styles.supplyName}
                />
                <View style={styles.supplyNums}>
                  <View style={styles.supplyNumBox}>
                    <Text style={styles.supplyNumLabel}>単価</Text>
                    <Input
                      value={String(s.unitPrice)}
                      onChangeText={(v) => patchSupply(idx, { unitPrice: toNum(v) })}
                      keyboardType="number-pad"
                      style={styles.supplyNumInput}
                    />
                  </View>
                  <View style={styles.supplyNumBox}>
                    <Text style={styles.supplyNumLabel}>数量</Text>
                    <Input
                      value={String(s.qty)}
                      onChangeText={(v) => patchSupply(idx, { qty: toNum(v) })}
                      keyboardType="number-pad"
                      style={styles.supplyNumInput}
                    />
                  </View>
                  <View style={styles.supplyNumBox}>
                    <Text style={styles.supplyNumLabel}>金額</Text>
                    <Text style={styles.supplyAmount}>¥{yen(supplyAmount(s))}</Text>
                  </View>
                </View>
                <Pressable onPress={() => removeSupply(idx)} hitSlop={8}>
                  <Text style={styles.removeBtn}>削除</Text>
                </Pressable>
              </View>
            ))}
            <View style={{ height: 6 }} />
            <Button title="＋ 明細を追加" variant="ghost" onPress={addSupply} />
            <View style={styles.supplyTotalRow}>
              <Text style={styles.billLabel}>合計</Text>
              <Text style={styles.billVal}>¥{yen(billing.supplies)}</Text>
            </View>
          </Card>

          {/* ── コメント ── */}
          <SectionTitle>コメント・提案</SectionTitle>
          <Card>
            <Input
              value={form.comment}
              onChangeText={(v) => patch({ comment: v })}
              placeholder="例: 害虫駆除継続　検査キット内、害虫の確認なし"
              multiline
            />
          </Card>

          {/* ── アクション ── */}
          <View style={styles.actions}>
            <Button title={isNew ? 'レポートを保存' : '変更を保存'} onPress={onSave} />
            {!isNew && (
              <>
                <View style={{ height: 10 }} />
                <Button title="このレポートを削除" variant="danger" onPress={onDelete} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: C.headerBg,
  },
  topbarBtn: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  topbarSave: { fontWeight: '800' },
  topbarTitle: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  billLabel: { fontSize: 14, color: C.textSub },
  billVal: { fontSize: 14, color: C.text, fontWeight: '600' },
  billDivider: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 4, paddingTop: 9 },
  billTotal: {
    backgroundColor: C.primaryLight,
    marginTop: 8,
    marginHorizontal: -14,
    marginBottom: -14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  billTotalLabel: { fontSize: 15, color: C.primaryDark, fontWeight: '700' },
  billTotalVal: { fontSize: 20, color: C.primaryDark, fontWeight: '900' },
  checklistBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  subLabel: { fontSize: 12, fontWeight: '600', color: C.textSub, marginBottom: 6 },
  pestRow: { paddingVertical: 6 },
  emptyLine: { color: C.textFaint, fontSize: 13, paddingVertical: 6 },
  supplyRow: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  supplyName: { marginBottom: 8 },
  supplyNums: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  supplyNumBox: { flex: 1 },
  supplyNumLabel: { fontSize: 11, color: C.textFaint, marginBottom: 4 },
  supplyNumInput: { paddingVertical: 8, textAlign: 'right' },
  supplyAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    textAlign: 'right',
    paddingVertical: 8,
  },
  removeBtn: { color: C.danger, fontSize: 13, marginTop: 8, textAlign: 'right' },
  supplyTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  actions: { marginHorizontal: 12, marginTop: 18 },
});
