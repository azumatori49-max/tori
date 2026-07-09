/**
 * 承認待ち画面
 * 会社を新規作成した直後（運営の利用開始承認前）に表示される。
 * 請求書払いの案内後、運営が承認するとアプリが使えるようになる。
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui';
import { C } from '@/constants/colors';
import logoAsset from '@/assets/logo.png';

export function PendingScreen() {
  const insets = useSafeAreaInsets();
  const org = useAuthStore((s) => s.org);
  const refreshOrg = useAuthStore((s) => s.refreshOrg);
  const signOut = useAuthStore((s) => s.signOut);
  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  async function onCheck() {
    setChecking(true);
    await refreshOrg();
    setChecking(false);
    setCheckedOnce(true);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.inner, { paddingTop: insets.top + 40 }]}
    >
      <View style={styles.brand}>
        <View style={styles.logoWrap}>
          <Image source={logoAsset} style={styles.logo} contentFit="contain" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>お申し込みありがとうございます</Text>
        <Text style={styles.orgName}>{org?.name ?? ''}</Text>
        <Text style={styles.body}>
          ただいま内容を確認しています。{'\n'}
          確認が終わりましたら、ご請求（お支払い）のご案内とあわせて{'\n'}
          利用開始のお知らせをいたします。{'\n\n'}
          開始まで今しばらくお待ちください。
        </Text>

        {checking ? (
          <View style={styles.loadingBtn}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <Button title="利用開始になったか確認する" onPress={() => void onCheck()} />
        )}
        {checkedOnce && !checking && (
          <Text style={styles.stillPending}>
            まだ承認されていません。開始までお待ちください。
          </Text>
        )}
      </View>

      <Pressable onPress={() => void signOut()} style={styles.signOut}>
        <Text style={styles.signOutText}>ログアウト</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.headerBg },
  inner: { padding: 24, paddingBottom: 48 },
  brand: { alignItems: 'center', marginBottom: 22 },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 68, height: 68 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 22 },
  title: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' },
  orgName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.primaryDark,
    textAlign: 'center',
    marginTop: 8,
  },
  body: {
    fontSize: 13,
    color: C.textSub,
    lineHeight: 21,
    textAlign: 'center',
    marginVertical: 18,
  },
  loadingBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  stillPending: { fontSize: 12, color: C.textFaint, textAlign: 'center', marginTop: 10 },
  signOut: { alignItems: 'center', marginTop: 18 },
  signOutText: { color: '#D8E7FA', fontSize: 13, textDecorationLine: 'underline' },
});
