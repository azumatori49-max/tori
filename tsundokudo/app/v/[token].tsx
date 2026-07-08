/**
 * 閲覧用リンクの入口: /v/<token>
 * トークンを検証してゲスト閲覧モードを開始し、レポート一覧へ遷移する。
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuthStore } from '@/store/authStore';
import { isCloudEnabled } from '@/lib/firebase';
import { C } from '@/constants/colors';

export default function ViewerEntryScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const enterGuestByToken = useAuthStore((s) => s.enterGuestByToken);
  const ready = useAuthStore((s) => s.ready);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // クラウド無効時は ready を待たない（authInit が呼ばれないため）
    if (isCloudEnabled && !ready) return;
    let cancelled = false;
    void (async () => {
      const ok =
        isCloudEnabled && token ? await enterGuestByToken(String(token)) : false;
      if (cancelled) return;
      if (ok) {
        router.replace('/(tabs)/reports');
      } else {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, enterGuestByToken]);

  return (
    <View style={styles.root}>
      {failed ? (
        <>
          <Text style={styles.title}>リンクが無効です</Text>
          <Text style={styles.sub}>
            閲覧用リンクが正しくないか、再発行された可能性があります。{'\n'}
            担当者に最新のリンクを確認してください。
          </Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/')}>
            <Text style={styles.btnText}>ログイン画面へ</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.sub}>閲覧ページを開いています…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.headerBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  sub: {
    color: '#D8E7FA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 14,
  },
  btn: {
    marginTop: 22,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  btnText: { color: C.primaryDark, fontSize: 15, fontWeight: '700' },
});
