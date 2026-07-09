/**
 * 初期設定画面（会社登録直後）
 * レポートの既定値（御請求先・契約プラン・料金・担当者）を最初に決めてもらう。
 * あとから設定タブでいつでも変更できる。スキップも可能。
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';
import { useReportStore } from '@/store/reportStore';
import { Button, Field, Input } from '@/components/ui';
import { C } from '@/constants/colors';
import logoAsset from '@/assets/logo.png';

export function DefaultsSetupScreen() {
  const insets = useSafeAreaInsets();
  const org = useAuthStore((s) => s.org);
  const settings = useReportStore((s) => s.settings);
  const updateSettings = useReportStore((s) => s.updateSettings);

  const [billingTo, setBillingTo] = useState(settings.defaultBillingTo);
  const [plan, setPlan] = useState(settings.defaultContractPlan || 'メンテナンス');
  const [fee, setFee] = useState(
    settings.defaultMaintenanceFee ? String(settings.defaultMaintenanceFee) : '',
  );
  const [technicians, setTechnicians] = useState(settings.technicians.join('、'));

  function save(skip: boolean) {
    if (skip) {
      updateSettings({ setupDone: true });
      return;
    }
    const billing = billingTo.trim();
    updateSettings({
      defaultBillingTo: billing,
      defaultContractPlan: plan.trim() || 'メンテナンス',
      defaultMaintenanceFee: Number(fee.replace(/[^0-9]/g, '')) || 0,
      technicians: technicians
        .split(/[、,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      billingTos: billing && !settings.billingTos.includes(billing)
        ? [...settings.billingTos, billing]
        : settings.billingTos,
      setupDone: true,
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logoWrap}>
            <Image source={logoAsset} style={styles.logo} contentFit="contain" />
          </View>
          <Text style={styles.title}>レポートの既定値を設定</Text>
          <Text style={styles.sub}>
            {org?.name ?? ''}{'\n'}
            レポート作成時に自動で入る値です。あとから設定タブで変更できます。
          </Text>
        </View>

        <View style={styles.card}>
          <Field label="御請求先（社名・住所）">
            <Input
              value={billingTo}
              onChangeText={setBillingTo}
              placeholder="例: 株式会社〇〇　〒000-0000 東京都…"
              multiline
            />
          </Field>
          <Field label="契約プラン">
            <Input value={plan} onChangeText={setPlan} placeholder="例: メンテナンス" />
          </Field>
          <Field label="メンテナンス料金（税抜・円）">
            <Input
              value={fee}
              onChangeText={setFee}
              placeholder="例: 50000"
              keyboardType="number-pad"
            />
          </Field>
          <Field label="施工担当者（複数は「、」区切り）">
            <Input
              value={technicians}
              onChangeText={setTechnicians}
              placeholder="例: 山田 太郎、佐藤 次郎"
            />
          </Field>

          <View style={{ height: 6 }} />
          <Button title="保存して始める" onPress={() => save(false)} />
          <Pressable style={styles.skip} onPress={() => save(true)}>
            <Text style={styles.skipText}>あとで設定する（スキップ）</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.headerBg },
  inner: { padding: 24, paddingBottom: 48 },
  brand: { alignItems: 'center', marginBottom: 20 },
  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logo: { width: 60, height: 60 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: {
    color: '#D8E7FA',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  skip: { alignItems: 'center', marginTop: 14 },
  skipText: { color: C.textSub, fontSize: 13, textDecorationLine: 'underline' },
});
