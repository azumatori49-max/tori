/**
 * 設定（マスタ）
 * - 既定の御請求先 / 契約プラン / メンテナンス料金
 * - 担当者・店舗の一覧（レポート作成時に自動追加もされる）
 * - 電球プライスなどの単価メモ
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { useAuthStore } from '@/store/authStore';
import { isSupabaseEnabled } from '@/lib/supabase';
import { confirmAsync } from '@/lib/dialog';
import { Button, Card, Field, Input, SectionTitle } from '@/components/ui';
import { C } from '@/constants/colors';
import { yen } from '@/lib/billing';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useReportStore((s) => s.settings);
  const updateSettings = useReportStore((s) => s.updateSettings);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);

  async function onSignOut() {
    const ok = await confirmAsync('ログアウト', 'ログアウトしますか？', 'ログアウト');
    if (ok) await signOut();
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>設定</Text>
        <Text style={styles.headerSub}>レポートの既定値・マスタ</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {isSupabaseEnabled && (
          <>
            <SectionTitle>アカウント</SectionTitle>
            <Card>
              <Text style={styles.accountLabel}>ログイン中</Text>
              <Text style={styles.accountEmail}>{session?.user.email ?? '—'}</Text>
              <Text style={styles.accountNote}>データは全員で共有されます（クラウド保存）。</Text>
              <View style={{ height: 12 }} />
              <Button title="ログアウト" variant="ghost" onPress={() => void onSignOut()} />
            </Card>
          </>
        )}

        <SectionTitle>既定値</SectionTitle>
        <Card>
          <Field label="御請求先">
            <Input
              value={settings.defaultBillingTo}
              onChangeText={(v) => updateSettings({ defaultBillingTo: v })}
              multiline
            />
          </Field>
          <Field label="契約プラン">
            <Input
              value={settings.defaultContractPlan}
              onChangeText={(v) => updateSettings({ defaultContractPlan: v })}
            />
          </Field>
          <Field label="メンテナンス料金（税抜・円）">
            <Input
              value={String(settings.defaultMaintenanceFee)}
              onChangeText={(v) =>
                updateSettings({ defaultMaintenanceFee: Number(v.replace(/[^0-9]/g, '')) || 0 })
              }
              keyboardType="number-pad"
            />
          </Field>
        </Card>

        <SectionTitle>担当者</SectionTitle>
        <Card>
          {settings.technicians.map((t) => (
            <View key={t} style={styles.listRow}>
              <Text style={styles.listDot}>•</Text>
              <Text style={styles.listText}>{t}</Text>
            </View>
          ))}
          <Text style={styles.hint}>※ レポート作成時に新しい担当者名を入力すると自動で追加されます</Text>
        </Card>

        <SectionTitle>店舗</SectionTitle>
        <Card>
          {settings.stores.map((s) => (
            <View key={s} style={styles.listRow}>
              <Text style={styles.listDot}>•</Text>
              <Text style={styles.listText}>{s}</Text>
            </View>
          ))}
          <Text style={styles.hint}>※ レポート作成時に新しい店舗名を入力すると自動で追加されます</Text>
        </Card>

        <SectionTitle>会社</SectionTitle>
        <Card>
          {settings.companies.map((c) => (
            <View key={c} style={styles.listRow}>
              <Text style={styles.listDot}>•</Text>
              <Text style={styles.listText}>{c}</Text>
            </View>
          ))}
          <Text style={styles.hint}>※ レポート作成時に新しい会社名を入力すると自動で追加されます</Text>
        </Card>

        <SectionTitle>単価メモ（電球プライス等）</SectionTitle>
        <Card>
          {settings.priceNotes.map((p) => (
            <View key={p.label} style={styles.priceRow}>
              <Text style={styles.priceLabel}>{p.label}</Text>
              <Text style={styles.priceVal}>¥{yen(p.price)}</Text>
            </View>
          ))}
        </Card>

        <Text style={styles.footer}>WINWIN メンテナンス報告書</Text>
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
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  listDot: { color: C.primary, fontSize: 16, marginRight: 8 },
  listText: { fontSize: 15, color: C.text },
  hint: { fontSize: 11, color: C.textFaint, marginTop: 8 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  priceLabel: { fontSize: 15, color: C.text, fontWeight: '600' },
  priceVal: { fontSize: 15, color: C.textSub },
  footer: { textAlign: 'center', color: C.textFaint, fontSize: 12, marginTop: 24 },
  accountLabel: { fontSize: 12, color: C.textSub },
  accountEmail: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 2 },
  accountNote: { fontSize: 12, color: C.textFaint, marginTop: 8 },
});
