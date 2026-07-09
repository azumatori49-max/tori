/**
 * 運営管理ページ（運営者専用タブ）
 *
 * 請求書払いの運用:
 *   - 承認待ち: 新規申し込みの一覧。内容確認・請求書送付後に「承認」
 *   - 利用中: 稼働中の会社。未払い等があれば「停止」（データは保持）
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';
import {
  fetchAllOrgs,
  isOperatorUser,
  setOrgActive,
  type OperatorOrgRow,
} from '@/lib/operator';
import { confirmAsync, notify } from '@/lib/dialog';
import { Card, SectionTitle } from '@/components/ui';
import { C } from '@/constants/colors';

function fmtDate(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isOperator = isOperatorUser(user);

  const [rows, setRows] = useState<OperatorOrgRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  async function reload() {
    try {
      setRows(await fetchAllOrgs());
      setError(false);
    } catch {
      setError(true);
    }
    setLoaded(true);
  }

  useEffect(() => {
    if (!isOperator) return;
    void (async () => {
      await reload();
    })();
  }, [isOperator]);

  async function onToggle(row: OperatorOrgRow) {
    const ok = await confirmAsync(
      row.active ? '利用を停止' : '利用開始を承認',
      row.active
        ? `「${row.name}」の利用を停止しますか？（データは残ります）`
        : `「${row.name}」の利用開始を承認しますか？`,
      row.active ? '停止する' : '承認する',
    );
    if (!ok) return;
    try {
      await setOrgActive(row.id, !row.active);
      await reload();
      notify('更新しました', `「${row.name}」を${row.active ? '停止' : '利用開始'}にしました。`);
    } catch {
      notify('エラー', '更新に失敗しました。Firestoreルールが最新か確認してください。');
    }
  }

  if (!isOperator) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.denied}>このページは運営者専用です</Text>
      </View>
    );
  }

  const pending = rows.filter((r) => !r.active);
  const active = rows.filter((r) => r.active);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>運営管理</Text>
        <Text style={styles.headerSub}>お申し込みの承認・利用状況</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* サマリー */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, pending.length > 0 && styles.statCardAlert]}>
            <Text style={styles.statNum}>{pending.length}</Text>
            <Text style={styles.statLabel}>承認待ち</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{active.length}</Text>
            <Text style={styles.statLabel}>利用中</Text>
          </View>
        </View>

        {error && (
          <Card>
            <Text style={styles.errorText}>
              一覧を読み込めませんでした。Firestoreルールが最新版に更新されているか確認してください。
            </Text>
          </Card>
        )}

        <SectionTitle>承認待ちの申し込み</SectionTitle>
        <Card>
          <Text style={styles.note}>
            内容を確認し、請求書を送付したら「承認」を押してください。承認するとその会社がアプリを使えるようになります。
          </Text>
          {loaded && pending.length === 0 && (
            <Text style={styles.empty}>現在、承認待ちの申し込みはありません</Text>
          )}
          {pending.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{row.name}</Text>
                <Text style={styles.rowMeta}>申込日: {fmtDate(row.createdAt)}</Text>
              </View>
              <Pressable style={styles.approveBtn} onPress={() => void onToggle(row)}>
                <Text style={styles.approveBtnText}>承認</Text>
              </Pressable>
            </View>
          ))}
        </Card>

        <SectionTitle>利用中の会社</SectionTitle>
        <Card>
          {loaded && active.length === 0 && (
            <Text style={styles.empty}>利用中の会社はまだありません</Text>
          )}
          {active.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{row.name}</Text>
                <Text style={styles.rowMeta}>開始申込: {fmtDate(row.createdAt)}</Text>
              </View>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>利用中</Text>
              </View>
              <Pressable style={styles.stopBtn} onPress={() => void onToggle(row)}>
                <Text style={styles.stopBtnText}>停止</Text>
              </Pressable>
            </View>
          ))}
        </Card>

        <Pressable style={styles.reloadBtn} onPress={() => void reload()}>
          <Text style={styles.reloadText}>一覧を更新する</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  denied: { color: C.textSub, fontSize: 14 },
  header: {
    backgroundColor: C.headerBg,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  headerSub: { color: '#D8E7FA', fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 12, marginTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    paddingVertical: 14,
  },
  statCardAlert: { borderColor: '#E8B93B', backgroundColor: '#FFFBEE' },
  statNum: { fontSize: 26, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 12, color: C.textSub, marginTop: 2 },
  note: { fontSize: 12, color: C.textFaint, lineHeight: 18, marginBottom: 8 },
  empty: { fontSize: 13, color: C.textFaint, paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowName: { fontSize: 15, fontWeight: '700', color: C.text },
  rowMeta: { fontSize: 11, color: C.textFaint, marginTop: 2 },
  approveBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  approveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  activeBadge: {
    backgroundColor: '#E5F5E9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#1E7B34' },
  stopBtn: {
    borderWidth: 1,
    borderColor: C.danger,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stopBtnText: { color: C.danger, fontSize: 13, fontWeight: '700' },
  reloadBtn: { alignItems: 'center', marginTop: 16 },
  reloadText: { fontSize: 13, color: C.textSub, textDecorationLine: 'underline' },
  errorText: { fontSize: 13, color: C.danger, lineHeight: 19 },
});
