/**
 * 設定（マスタ）
 * - アカウント / 会社（組織）・招待コード・閲覧用リンク
 * - 既定の御請求先 / 契約プラン / メンテナンス料金
 * - 担当者・店舗の一覧（レポート作成時に自動追加もされる）
 * - 電球プライスなどの単価メモ
 */
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { useAuthStore, useIsViewer } from '@/store/authStore';
import { isSupabaseEnabled } from '@/lib/supabase';
import { confirmAsync, notify } from '@/lib/dialog';
import { Button, Card, Field, Input, SectionTitle } from '@/components/ui';
import { C } from '@/constants/colors';
import { yen } from '@/lib/billing';

/** 閲覧用リンクの完全URL（Webのみ。GitHub Pages はサブパス /tori を付ける） */
function viewerLinkFor(token: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return `/v/${token}`;
  const sub = window.location.hostname.endsWith('github.io') ? '/tori' : '';
  return `${window.location.origin}${sub}/v/${token}`;
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      notify('コピーしました', `${label}をコピーしました。`);
      return;
    }
  } catch {
    // フォールバックへ
  }
  notify(label, text);
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useReportStore((s) => s.settings);
  const updateSettings = useReportStore((s) => s.updateSettings);
  const session = useAuthStore((s) => s.session);
  const org = useAuthStore((s) => s.org);
  const guestOrg = useAuthStore((s) => s.guestOrg);
  const rotateOrgCode = useAuthStore((s) => s.rotateOrgCode);
  const signOut = useAuthStore((s) => s.signOut);
  const isViewer = useIsViewer();

  async function onSignOut() {
    const ok = isViewer
      ? await confirmAsync('閲覧を終了', 'ログイン画面に戻りますか？', '戻る')
      : await confirmAsync('ログアウト', 'ログアウトしますか？', 'ログアウト');
    if (ok) await signOut();
  }

  async function onRotate(kind: 'invite' | 'viewer') {
    const label = kind === 'invite' ? '招待コード' : '閲覧用リンク';
    const ok = await confirmAsync(
      `${label}を再発行`,
      `今の${label}は使えなくなります。再発行しますか？`,
      '再発行',
    );
    if (!ok) return;
    if (await rotateOrgCode(kind)) {
      notify('再発行しました', `新しい${label}を共有してください。`);
    }
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
              <Text style={styles.accountLabel}>
                {isViewer ? '閲覧モード' : 'ログイン中'}
              </Text>
              <Text style={styles.accountEmail}>
                {isViewer
                  ? (guestOrg?.name ?? '閲覧専用（ログインなし）')
                  : (session?.user.email ?? '—')}
              </Text>
              <Text style={styles.accountNote}>
                {isViewer
                  ? 'レポートの閲覧・PDF出力のみ可能です。'
                  : 'データは会社（チーム）内で共有されます（クラウド保存）。'}
              </Text>
              <View style={{ height: 12 }} />
              <Button
                title={isViewer ? 'ログイン画面へ戻る' : 'ログアウト'}
                variant="ghost"
                onPress={() => void onSignOut()}
              />
            </Card>

            {!isViewer && org && (
              <>
                <SectionTitle>会社（チーム）</SectionTitle>
                <Card>
                  <Text style={styles.accountLabel}>会社名</Text>
                  <Text style={styles.accountEmail}>{org.name}</Text>
                  <Text style={styles.accountNote}>
                    あなたの権限: {org.role === 'admin' ? '管理者' : 'メンバー'}
                  </Text>

                  {org.role === 'admin' && (
                    <>
                      <View style={styles.divider} />
                      <Text style={styles.shareTitle}>メンバー招待</Text>
                      <Text style={styles.accountNote}>
                        スタッフに下の招待コードを共有すると、新規登録後に同じ会社へ参加できます。
                      </Text>
                      <View style={styles.codeRow}>
                        <Text style={styles.codeText} numberOfLines={1}>
                          {org.inviteCode}
                        </Text>
                        <Pressable
                          style={styles.codeBtn}
                          onPress={() => void copyText(org.inviteCode, '招待コード')}
                        >
                          <Text style={styles.codeBtnText}>コピー</Text>
                        </Pressable>
                      </View>
                      <Pressable style={styles.rotateBtn} onPress={() => void onRotate('invite')}>
                        <Text style={styles.rotateText}>招待コードを再発行する</Text>
                      </Pressable>

                      <View style={styles.divider} />
                      <Text style={styles.shareTitle}>閲覧用リンク（店長など）</Text>
                      <Text style={styles.accountNote}>
                        このリンクを開くと、ログイン不要でレポートの閲覧・PDF出力ができます。
                      </Text>
                      <View style={styles.codeRow}>
                        <Text style={styles.codeText} numberOfLines={1}>
                          {viewerLinkFor(org.viewerToken)}
                        </Text>
                        <Pressable
                          style={styles.codeBtn}
                          onPress={() =>
                            void copyText(viewerLinkFor(org.viewerToken), '閲覧用リンク')
                          }
                        >
                          <Text style={styles.codeBtnText}>コピー</Text>
                        </Pressable>
                      </View>
                      <Pressable style={styles.rotateBtn} onPress={() => void onRotate('viewer')}>
                        <Text style={styles.rotateText}>閲覧用リンクを再発行する</Text>
                      </Pressable>
                    </>
                  )}
                </Card>
              </>
            )}
          </>
        )}

        {isViewer ? (
          <Text style={styles.footer}>らくらく店舗メンテナンス</Text>
        ) : (
          <>
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

            <SectionTitle>御請求先</SectionTitle>
            <Card>
              {settings.billingTos.map((b) => (
                <View key={b} style={styles.listRow}>
                  <Text style={styles.listDot}>•</Text>
                  <Text style={styles.listText}>{b}</Text>
                </View>
              ))}
              <Text style={styles.hint}>
                ※ レポート作成時に新しい御請求先を入力すると自動で追加されます
              </Text>
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

            <Text style={styles.footer}>らくらく店舗メンテナンス</Text>
          </>
        )}
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
  headerSub: { color: '#D8E7FA', fontSize: 13, marginTop: 2 },
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
  accountNote: { fontSize: 12, color: C.textFaint, marginTop: 8, lineHeight: 18 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  shareTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: C.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  codeText: { flex: 1, fontSize: 13, color: C.text },
  codeBtn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  codeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rotateBtn: { marginTop: 8, alignSelf: 'flex-start' },
  rotateText: { fontSize: 12, color: C.textSub, textDecorationLine: 'underline' },
});
