/**
 * メンテナンスレポート 入力フォーム（新規 / 編集 兼用）
 *
 * ルート:
 *   /report/new   … 新規作成（任意で ?store= で店舗を初期指定）
 *   /report/:id   … 既存レポートの編集
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

import { useReportStore } from '@/store/reportStore';
import { useIsViewer } from '@/store/authStore';
import { confirmAsync, notify } from '@/lib/dialog';
import {
  Button,
  Card,
  CheckBox,
  ChipSelect,
  Dropdown,
  Field,
  Input,
  SectionTitle,
} from '@/components/ui';
import { PhotoSection } from '@/components/report/PhotoSection';
import { DatePicker } from '@/components/report/DatePicker';
import {
  CONDITION_OPTIONS,
  DEFAULT_TOPPING_NAMES,
  OPTIONAL_PHOTO_CHECK_NAMES,
  PEST_PRESENCE_OPTIONS,
} from '@/constants/hygiene';
import { C, CONDITION_COLOR } from '@/constants/colors';
import { calcBilling, supplyAmount, yen } from '@/lib/billing';
import { exportReportPdf } from '@/lib/exportPdf';
import { pdfBlockReason } from '@/lib/reportValidation';
import type {
  AnnualSchedule,
  ChecklistItem,
  DiyItem,
  MaintenanceReportInsert,
  PestPresence,
  ReportPhoto,
  SupplyLine,
  ToppingItem,
} from '@/types/report';

/** 施工担当者は「、」区切りで複数名を保持する */
const TECH_SEP = '、';
function splitTech(value: string): string[] {
  return value.split(TECH_SEP).map((s) => s.trim()).filter(Boolean);
}

function toNum(v: string): number {
  return Number(v.replace(/[^0-9]/g, '')) || 0;
}

export default function ReportFormScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; store?: string }>();
  const id = params.id;
  const isNew = id === 'new';
  const isViewer = useIsViewer();

  const store = useReportStore();
  const existing = isNew ? undefined : store.getReport(id);

  // 施工中のフォーム状態（保存するまでストアには反映しない）
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

  // 閲覧専用アカウントは編集画面に入れない（閲覧画面へ振り替え）
  if (isViewer) {
    return <Redirect href={isNew ? '/reports' : `/report/view/${id}`} />;
  }

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

  function addTopping() {
    setForm((f) => ({
      ...f,
      toppings: [...f.toppings, { name: '', checked: true, comment: '', fee: 0 }],
    }));
  }

  function removeTopping(idx: number) {
    setForm((f) => ({ ...f, toppings: f.toppings.filter((_, i) => i !== idx) }));
  }

  function patchDiy(idx: number, p: Partial<DiyItem>) {
    setForm((f) => ({
      ...f,
      diy: f.diy.map((d, i) => (i === idx ? { ...d, ...p } : d)),
    }));
  }

  function addDiy() {
    setForm((f) => ({
      ...f,
      diy: [...f.diy, { name: '', checked: true, comment: '', fee: 0, photos: [] }],
    }));
  }

  function removeDiy(idx: number) {
    setForm((f) => ({ ...f, diy: f.diy.filter((_, i) => i !== idx) }));
  }

  function patchAnnual(p: Partial<AnnualSchedule>) {
    setForm((f) => ({ ...f, annualSchedule: { ...f.annualSchedule, ...p } }));
  }

  function toggleTechnician(name: string) {
    setForm((f) => {
      const list = splitTech(f.technician);
      const next = list.includes(name)
        ? list.filter((n) => n !== name)
        : [...list, name];
      return { ...f, technician: next.join(TECH_SEP) };
    });
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

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/reports');
  }

  async function onSave() {
    // 途中でも一時保存できる（写真などの必須チェックはPDF出力時に行う）
    if (!form.storeName.trim()) {
      notify('店舗名を入力してください');
      return;
    }
    const ok = isNew
      ? await store.createReport(form)
      : await store.updateReport(id, form);
    if (ok) {
      goBack();
    } else {
      notify('保存できませんでした', useReportStore.getState().error ?? '保存に失敗しました。');
    }
  }

  async function onExport() {
    // 提出（PDF）は必須項目が揃っていないと出力できない
    const reason = pdfBlockReason(form);
    if (reason) {
      notify('PDFに変換できません', `未完成の項目があります。\n${reason}`);
      return;
    }
    try {
      const res = await exportReportPdf(form);
      if (res.message) notify('PDF', res.message);
    } catch (e) {
      notify('PDF出力に失敗しました', e instanceof Error ? e.message : String(e));
    }
  }

  async function onDelete() {
    const ok = await confirmAsync('レポートを削除', 'この操作は取り消せません。', '削除');
    if (!ok) return;
    const done = await store.deleteReport(id);
    if (done) goBack();
    else notify('削除できませんでした', useReportStore.getState().error ?? '');
  }

  return (
    <View style={styles.root}>
      {/* ヘッダーバー */}
      <View style={[styles.topbar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={10}>
          <Text style={styles.topbarBtn}>‹ 戻る</Text>
        </Pressable>
        <Text style={styles.topbarTitle}>{isNew ? '新規レポート' : 'レポート編集'}</Text>
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
          {/* ── 基本情報 ── */}
          <SectionTitle>基本情報</SectionTitle>
          <Card>
            <Field label="施工店舗">
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
            <Field label="会社名">
              <Input
                value={form.company}
                onChangeText={(v) => patch({ company: v })}
                placeholder="例: 株式会社鶏ヤロー"
              />
              <View style={{ height: 8 }} />
              <ChipSelect
                options={store.settings.companies}
                value={form.company}
                onChange={(v) => patch({ company: v })}
              />
            </Field>
            <Field label="施工日">
              <DatePicker value={form.workDate} onChange={(v) => patch({ workDate: v })} />
            </Field>
            <Field label="契約プラン">
              <Input
                value={form.contractPlan}
                onChangeText={(v) => patch({ contractPlan: v })}
                placeholder="例: メンテナンス"
              />
            </Field>
            <Field label="施工担当者（複数選択可）">
              <View style={styles.techWrap}>
                {store.settings.technicians.map((name) => {
                  const active = splitTech(form.technician).includes(name);
                  return (
                    <Pressable
                      key={name}
                      onPress={() => toggleTechnician(name)}
                      style={[styles.techChip, active && styles.techChipActive]}
                    >
                      <Text style={[styles.techCheck, active && styles.techCheckOn]}>
                        {active ? '✓' : ''}
                      </Text>
                      <Text style={[styles.techText, active && styles.techTextActive]}>{name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {!!form.technician && (
                <Text style={styles.techSelected}>選択中: {form.technician}</Text>
              )}
            </Field>
            <Field label="御請求先">
              <Input
                value={form.billingTo}
                onChangeText={(v) => patch({ billingTo: v })}
                multiline
              />
              <View style={{ height: 8 }} />
              <ChipSelect
                options={store.settings.billingTos}
                value={form.billingTo}
                onChange={(v) => patch({ billingTo: v })}
              />
            </Field>
          </Card>

          {/* ── 写真 ── */}
          <SectionTitle>
            写真 <Text style={styles.required}>PDF出力に必須</Text>
          </SectionTitle>
          <Card>
            <Text style={styles.hintText}>
              写真がなくても「保存」で一時保存できます。
              PDF出力（提出）には各項目の写真が必要です（「任意」表示の項目を除く）。
            </Text>
            <PhotoSection
              photos={form.photos}
              onChange={(photos) => patch({ photos })}
            />
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
              <Text style={styles.billLabel}>プチDIY</Text>
              <Text style={styles.billVal}>¥{yen(billing.diy)}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>年間スケジュール</Text>
              <Text style={styles.billVal}>¥{yen(billing.annual)}</Text>
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
          <SectionTitle>
            定期点検 <Text style={styles.required}>写真はPDF出力に必須</Text>
            <Text style={styles.optionalTag}>（「任意」表示の項目を除く）</Text>
          </SectionTitle>
          {form.checklist.map((item, idx) => (
            <Card key={item.name}>
              <CheckBox
                checked={item.checked}
                onToggle={() => patchChecklist(idx, { checked: !item.checked })}
                label={item.name}
              />
              {item.checked && (
                <View style={styles.checklistBody}>
                  {item.subChecks && (
                    <View style={styles.subChecks}>
                      {item.subChecks.map((sc, sIdx) => (
                        <CheckBox
                          key={sc.name}
                          checked={sc.checked}
                          label={sc.name}
                          size={20}
                          onToggle={() =>
                            patchChecklist(idx, {
                              subChecks: item.subChecks!.map((x, i) =>
                                i === sIdx ? { ...x, checked: !x.checked } : x,
                              ),
                            })
                          }
                        />
                      ))}
                    </View>
                  )}
                  <Text style={styles.subLabel}>状況</Text>
                  <Dropdown
                    options={CONDITION_OPTIONS}
                    value={item.condition}
                    onChange={(v) => patchChecklist(idx, { condition: v as ChecklistItem['condition'] })}
                    placeholder="状況を選択"
                    colorMap={CONDITION_COLOR}
                  />
                  <View style={{ height: 8 }} />
                  <Input
                    value={item.note}
                    onChangeText={(v) => patchChecklist(idx, { note: v })}
                    placeholder="備考"
                  />
                  <Text style={styles.subLabel}>
                    写真（最大6枚）
                    {OPTIONAL_PHOTO_CHECK_NAMES.includes(item.name) && (
                      <Text style={styles.optionalTag}>任意</Text>
                    )}
                  </Text>
                  <PhotoSection
                    photos={item.photos}
                    onChange={(photos: ReportPhoto[]) => patchChecklist(idx, { photos })}
                    max={6}
                    defaultCategory="施工後"
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
            <Text style={styles.subLabel}>
              害虫の状況（いるかいないか）<Text style={styles.required}>PDF出力に必須</Text>
            </Text>
            <ChipSelect
              options={[...PEST_PRESENCE_OPTIONS]}
              value={form.pestControl.presence}
              allowEmpty={false}
              onChange={(v) =>
                patch({
                  pestControl: {
                    ...form.pestControl,
                    presence: v as PestPresence | '',
                  },
                })
              }
            />
            <Text style={styles.subLabel}>
              写真（最大6枚）<Text style={styles.required}>PDF出力に必須</Text>
            </Text>
            <PhotoSection
              photos={form.pestControl.photos}
              onChange={(photos: ReportPhoto[]) =>
                patch({ pestControl: { ...form.pestControl, photos } })
              }
              max={6}
              defaultCategory="その他"
            />
          </Card>

          {/* ── トッピング ── */}
          <SectionTitle>トッピング（追加施工）</SectionTitle>
          {form.toppings.map((t, idx) => {
            const isCustom = !DEFAULT_TOPPING_NAMES.includes(t.name);
            return (
              <Card key={`top-${idx}`}>
                <View style={styles.rowInline}>
                  <CheckBox
                    checked={t.checked}
                    onToggle={() => patchTopping(idx, { checked: !t.checked })}
                    label={isCustom ? undefined : t.name}
                  />
                  {isCustom && (
                    <>
                      <Input
                        value={t.name}
                        onChangeText={(v) => patchTopping(idx, { name: v })}
                        placeholder="項目名（自由入力）"
                        style={styles.inlineInput}
                      />
                      <Pressable onPress={() => removeTopping(idx)} hitSlop={8}>
                        <Text style={styles.removeBtn}>削除</Text>
                      </Pressable>
                    </>
                  )}
                </View>
                {t.checked && (
                  <View style={styles.checklistBody}>
                    <Input
                      value={t.comment}
                      onChangeText={(v) => patchTopping(idx, { comment: v })}
                      placeholder="コメント"
                      multiline
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
            );
          })}
          <View style={styles.addInline}>
            <Button title="＋ トッピングを追加" variant="ghost" onPress={addTopping} />
          </View>

          {/* ── プチDIY（自分で追加） ── */}
          <SectionTitle>プチDIY</SectionTitle>
          {form.diy.length === 0 && (
            <Card>
              <Text style={styles.emptyLine}>下のボタンから施工内容を登録できます</Text>
            </Card>
          )}
          {form.diy.map((d, idx) => (
            <Card key={`diy-${idx}`}>
              <View style={styles.rowInline}>
                <Input
                  value={d.name}
                  onChangeText={(v) => patchDiy(idx, { name: v })}
                  placeholder="施工名（例: 冷蔵庫パッキン清掃）"
                  style={styles.inlineInput}
                />
                <Pressable onPress={() => removeDiy(idx)} hitSlop={8}>
                  <Text style={styles.removeBtn}>削除</Text>
                </Pressable>
              </View>
              <View style={styles.checklistBody}>
                <Input
                  value={d.comment}
                  onChangeText={(v) => patchDiy(idx, { comment: v })}
                  placeholder="コメント（例: 交換なし、清掃完了）"
                  multiline
                />
                <View style={{ height: 8 }} />
                <Field label="金額（税抜・円）">
                  <Input
                    value={String(d.fee)}
                    onChangeText={(v) => patchDiy(idx, { fee: toNum(v) })}
                    keyboardType="number-pad"
                  />
                </Field>
                <Text style={styles.subLabel}>写真（最大6枚）</Text>
                <PhotoSection
                  photos={d.photos}
                  onChange={(photos: ReportPhoto[]) => patchDiy(idx, { photos })}
                  max={6}
                  defaultCategory="施工後"
                />
              </View>
            </Card>
          ))}
          <View style={styles.addInline}>
            <Button title="＋ プチDIYを追加" variant="ghost" onPress={addDiy} />
          </View>

          {/* ── 年間スケジュール ── */}
          <SectionTitle>年間スケジュール</SectionTitle>
          <Card>
            <Field label="コメント">
              <Input
                value={form.annualSchedule.comment}
                onChangeText={(v) => patchAnnual({ comment: v })}
                placeholder="例: 12月 冷蔵庫パッキン / 4月エアコン清掃 / 9月排水管清掃 …"
                multiline
              />
            </Field>
            <Field label="追加費用（税抜・円）">
              <Input
                value={String(form.annualSchedule.fee)}
                onChangeText={(v) => patchAnnual({ fee: toNum(v) })}
                keyboardType="number-pad"
              />
            </Field>
            <Text style={styles.subLabel}>写真（最大6枚）</Text>
            <PhotoSection
              photos={form.annualSchedule.photos}
              onChange={(photos: ReportPhoto[]) => patchAnnual({ photos })}
              max={6}
              defaultCategory="その他"
            />
          </Card>

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
            <Button title={isNew ? 'レポートを保存' : '変更を保存'} onPress={() => void onSave()} />
            <View style={{ height: 10 }} />
            <Button title="PDF出力・共有" variant="ghost" onPress={() => void onExport()} />
            {!isNew && (
              <>
                <View style={{ height: 10 }} />
                <Button
                  title="閲覧者用画面で確認"
                  variant="ghost"
                  onPress={() => router.push(`/report/view/${id}`)}
                />
                <View style={{ height: 10 }} />
                <Button title="このレポートを削除" variant="danger" onPress={() => void onDelete()} />
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
  subChecks: { gap: 10, marginBottom: 4 },
  subLabel: { fontSize: 12, fontWeight: '600', color: C.textSub, marginBottom: 6, marginTop: 10 },
  required: { fontSize: 10, fontWeight: '800', color: C.danger },
  optionalTag: { fontSize: 10, fontWeight: '700', color: C.textFaint },
  hintText: { fontSize: 11, color: C.textFaint, marginBottom: 8, lineHeight: 17 },
  techWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  techChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFF',
  },
  techChipActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  techCheck: { fontSize: 13, color: 'transparent', fontWeight: '900', marginRight: 4 },
  techCheckOn: { color: C.primary },
  techText: { fontSize: 14, color: C.textSub },
  techTextActive: { color: C.primaryDark, fontWeight: '700' },
  techSelected: { fontSize: 12, color: C.textSub, marginTop: 8 },
  rowInline: { flexDirection: 'row', alignItems: 'center' },
  inlineInput: { flex: 1, marginLeft: 8, paddingVertical: 8 },
  addInline: { marginHorizontal: 12, marginTop: 4 },
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
