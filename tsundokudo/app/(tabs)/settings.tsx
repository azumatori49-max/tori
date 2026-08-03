/**
 * 設定（マスタ）
 * - アカウント / 会社（組織）・招待コード・閲覧用リンク
 * - 既定の御請求先 / 契約プラン / メンテナンス料金
 * - 担当者・店舗の一覧（レポート作成時に自動追加もされる）
 * - 電球プライスなどの単価メモ
 */
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { useAuthStore, useIsViewer } from '@/store/authStore';
import { isCloudEnabled } from '@/lib/firebase';
import { cloudUpsertReport } from '@/lib/cloudReports';
import { canImportLegacy, fetchLegacyReports } from '@/lib/legacyImport';
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

/** スマホの共有シートで閲覧用リンクを送る（LINE・メール等）。非対応環境はコピー */
async function shareViewerLink(url: string, orgName: string): Promise<void> {
  type ShareNav = Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  };
  const nav = typeof navigator !== 'undefined' ? (navigator as ShareNav) : null;
  if (nav?.share) {
    try {
      await nav.share({
        title: `${orgName} メンテナンスレポート`,
        text: `${orgName}のメンテナンスレポートはこちらから確認できます（ログイン不要）`,
        url,
      });
      return;
    } catch {
      // キャンセル時は何もしない
      return;
    }
  }
  await copyText(url, '閲覧用リンク');
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

/** 追加・削除できる文字列リスト（担当者・店舗・会社・御請求先マスタ用） */
function EditableList({
  items,
  placeholder,
  onChange,
  multiline,
}: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft('');
  }

  return (
    <>
      {items.map((item) => (
        <View key={item} style={styles.listRow}>
          <Text style={styles.listDot}>•</Text>
          <Text style={styles.listText}>{item}</Text>
          <Pressable
            onPress={() => onChange(items.filter((x) => x !== item))}
            hitSlop={8}
            style={styles.removeBtn}
          >
            <Text style={styles.removeBtnText}>✕</Text>
          </Pressable>
        </View>
      ))}
      {items.length === 0 && <Text style={styles.emptyText}>まだ登録がありません</Text>}
      <View style={styles.addRow}>
        <View style={{ flex: 1 }}>
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            multiline={multiline}
          />
        </View>
        <Pressable style={styles.addBtn} onPress={add}>
          <Text style={styles.addBtnText}>追加</Text>
        </Pressable>
      </View>
    </>
  );
}

/** 単価メモ（名前＋金額）の追加・削除 */
function PriceNotesEditor({
  items,
  onChange,
}: {
  items: { label: string; price: number }[];
  onChange: (items: { label: string; price: number }[]) => void;
}) {
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');

  function add() {
    const l = label.trim();
    const p = Number(price.replace(/[^0-9]/g, '')) || 0;
    if (!l || items.some((x) => x.label === l)) return;
    onChange([...items, { label: l, price: p }]);
    setLabel('');
    setPrice('');
  }

  return (
    <>
      {items.map((p) => (
        <View key={p.label} style={styles.priceRow}>
          <Text style={styles.priceLabel}>{p.label}</Text>
          <Text style={styles.priceVal}>¥{yen(p.price)}</Text>
          <Pressable
            onPress={() => onChange(items.filter((x) => x.label !== p.label))}
            hitSlop={8}
            style={styles.removeBtn}
          >
            <Text style={styles.removeBtnText}>✕</Text>
          </Pressable>
        </View>
      ))}
      {items.length === 0 && <Text style={styles.emptyText}>まだ登録がありません</Text>}
      <View style={styles.addRow}>
        <View style={{ flex: 2 }}>
          <Input value={label} onChangeText={setLabel} placeholder="名前（例: E26）" />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            value={price}
            onChangeText={setPrice}
            placeholder="金額"
            keyboardType="number-pad"
          />
        </View>
        <Pressable style={styles.addBtn} onPress={add}>
          <Text style={styles.addBtnText}>追加</Text>
        </Pressable>
      </View>
    </>
  );
}

/** 旧システム（Supabase）からのデータ引っ越しカード */
function LegacyImportCard({ orgId }: { orgId: string }) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  async function run() {
    if (!link.trim() || busy) return;
    setBusy(true);
    setProgress('旧システムからデータを取得中…');
    try {
      const reports = await fetchLegacyReports(link);
      if (reports.length === 0) {
        setProgress('引っ越せるレポートが見つかりませんでした。リンクを確認してください。');
        return;
      }
      let done = 0;
      for (const report of reports) {
        done += 1;
        setProgress(`引っ越し中… ${done} / ${reports.length} 件`);
        await cloudUpsertReport(report, orgId);
      }
      // 取り込み後に一覧を再読み込み
      useReportStore.setState({ hydrated: false });
      await useReportStore.getState().hydrate();
      setProgress(`完了！ ${reports.length} 件のレポートを引っ越しました。`);
      setLink('');
    } catch (e) {
      setProgress(e instanceof Error ? e.message : '引っ越しに失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionTitle>旧システムからの引っ越し</SectionTitle>
      <Card>
        <Text style={styles.accountNote}>
          以前のシステムのレポートをこちらへコピーします。旧アプリの設定画面にあった
          「閲覧用リンク」を貼り付けて実行してください（何度実行しても重複しません）。
        </Text>
        <View style={{ height: 10 }} />
        <Field label="旧・閲覧用リンク">
          <Input
            value={link}
            onChangeText={setLink}
            placeholder="https://…/v/xxxxxxxx"
            autoCapitalize="none"
          />
        </Field>
        <Button
          title={busy ? '引っ越し中…' : 'データを引っ越す'}
          onPress={() => void run()}
        />
        {progress !== '' && <Text style={styles.importProgress}>{progress}</Text>}
      </Card>
    </>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useReportStore((s) => s.settings);
  const updateSettings = useReportStore((s) => s.updateSettings);
  const user = useAuthStore((s) => s.user);
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
        {isCloudEnabled && (
          <>
            <SectionTitle>アカウント</SectionTitle>
            <Card>
              <Text style={styles.accountLabel}>
                {isViewer ? '閲覧モード' : 'ログイン中'}
              </Text>
              <Text style={styles.accountEmail}>
                {isViewer
                  ? (guestOrg?.name ?? '閲覧専用（ログインなし）')
                  : (user?.email ?? '—')}
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
                    </>
                  )}

                  {/* 閲覧用リンクはメンバー全員が共有できる（エリアマネージャー等） */}
                  <View style={styles.divider} />
                  <Text style={styles.shareTitle}>閲覧用リンク（店長など）</Text>
                  <Text style={styles.accountNote}>
                    このリンクを開くと、ログイン不要でレポートの閲覧・PDF出力ができます。
                    「共有」からLINEやメールでそのまま送れます。
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
                  <Pressable
                    style={styles.shareBtn}
                    onPress={() =>
                      void shareViewerLink(viewerLinkFor(org.viewerToken), org.name)
                    }
                  >
                    <Text style={styles.shareBtnText}>共有（LINE・メールなど）</Text>
                  </Pressable>
                  {org.role === 'admin' && (
                    <Pressable style={styles.rotateBtn} onPress={() => void onRotate('viewer')}>
                      <Text style={styles.rotateText}>閲覧用リンクを再発行する</Text>
                    </Pressable>
                  )}
                </Card>

                {canImportLegacy && org.role === 'admin' && (
                  <LegacyImportCard orgId={org.id} />
                )}
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
          <EditableList
            items={settings.technicians}
            placeholder="担当者名を入力"
            onChange={(technicians) => updateSettings({ technicians })}
          />
          <Text style={styles.hint}>※ レポート作成時に新しい担当者名を入力すると自動で追加されます</Text>
        </Card>

        <SectionTitle>店舗</SectionTitle>
        <Card>
          <EditableList
            items={settings.stores}
            placeholder="店舗名を入力"
            onChange={(stores) => updateSettings({ stores })}
          />
          <Text style={styles.hint}>※ レポート作成時に新しい店舗名を入力すると自動で追加されます</Text>
        </Card>

        <SectionTitle>会社</SectionTitle>
        <Card>
          <EditableList
            items={settings.companies}
            placeholder="会社名を入力"
            onChange={(companies) => updateSettings({ companies })}
          />
          <Text style={styles.hint}>※ レポート作成時に新しい会社名を入力すると自動で追加されます</Text>
        </Card>

            <SectionTitle>御請求先</SectionTitle>
            <Card>
              <EditableList
                items={settings.billingTos}
                placeholder="御請求先（社名・住所）を入力"
                multiline
                onChange={(billingTos) => updateSettings({ billingTos })}
              />
              <Text style={styles.hint}>
                ※ レポート作成時に新しい御請求先を入力すると自動で追加されます
              </Text>
            </Card>

            <SectionTitle>単価メモ（電球プライス等）</SectionTitle>
            <Card>
              <PriceNotesEditor
                items={settings.priceNotes}
                onChange={(priceNotes) => updateSettings({ priceNotes })}
              />
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
  listText: { flex: 1, fontSize: 15, color: C.text },
  hint: { fontSize: 11, color: C.textFaint, marginTop: 8 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  priceLabel: { flex: 1, fontSize: 15, color: C.text, fontWeight: '600' },
  priceVal: { fontSize: 15, color: C.textSub },
  removeBtn: {
    marginLeft: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },
  removeBtnText: { color: C.danger, fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 13, color: C.textFaint, paddingVertical: 4 },
  addRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  footer: { textAlign: 'center', color: C.textFaint, fontSize: 12, marginTop: 24 },
  importProgress: { fontSize: 13, color: C.primaryDark, marginTop: 10, lineHeight: 19 },
  opRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  opName: { fontSize: 14, fontWeight: '700', color: C.text },
  opMeta: { fontSize: 11, color: C.textFaint, marginTop: 2 },
  opBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  opBadgeOn: { backgroundColor: '#E5F5E9' },
  opBadgeOff: { backgroundColor: '#FFF3DC' },
  opBadgeOnText: { fontSize: 11, fontWeight: '700', color: '#1E7B34' },
  opBadgeOffText: { fontSize: 11, fontWeight: '700', color: '#9A6B00' },
  opBtn: {
    backgroundColor: C.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  opBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
  shareBtn: {
    marginTop: 10,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  rotateBtn: { marginTop: 8, alignSelf: 'flex-start' },
  rotateText: { fontSize: 12, color: C.textSub, textDecorationLine: 'underline' },
});
