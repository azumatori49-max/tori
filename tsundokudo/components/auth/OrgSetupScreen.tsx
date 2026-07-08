/**
 * 組織セットアップ画面
 * ログイン済みだが組織に未所属のユーザー向け。
 * 「会社を新規作成」または「招待コードで参加」を選ぶ。
 */
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { Button, Field, Input } from '@/components/ui';
import { C } from '@/constants/colors';
import logoAsset from '@/assets/logo.png';

export function OrgSetupScreen() {
  const insets = useSafeAreaInsets();
  const createOrg = useAuthStore((s) => s.createOrg);
  const joinOrg = useAuthStore((s) => s.joinOrg);
  const signOut = useAuthStore((s) => s.signOut);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  const [orgName, setOrgName] = useState('');
  const [code, setCode] = useState('');

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
          <Text style={styles.title}>はじめましょう</Text>
          <Text style={styles.sub}>会社（チーム）を設定してください</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>会社を新規作成</Text>
          <Text style={styles.cardNote}>
            あなたが管理者になります。あとから招待コードでメンバーを追加できます。
          </Text>
          <Field label="会社名">
            <Input
              value={orgName}
              onChangeText={setOrgName}
              placeholder="例: 株式会社〇〇メンテナンス"
            />
          </Field>
          {loading ? (
            <View style={styles.loadingBtn}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <Button
              title="この会社で始める"
              onPress={() => void (orgName.trim() && createOrg(orgName))}
            />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>招待コードで参加</Text>
          <Text style={styles.cardNote}>
            会社の管理者から共有された招待コードを入力してください。
          </Text>
          <Field label="招待コード">
            <Input
              value={code}
              onChangeText={setCode}
              placeholder="例: 3f8a1b2c9d0e"
              autoCapitalize="none"
            />
          </Field>
          <Button
            title="参加する"
            variant="ghost"
            onPress={() => void (code.trim() && joinOrg(code))}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable onPress={() => void signOut()} style={styles.signOut}>
          <Text style={styles.signOutText}>ログアウトして戻る</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 12,
  },
  logo: { width: 68, height: 68 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#D8E7FA', fontSize: 13, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 14 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 6 },
  cardNote: { fontSize: 12, color: C.textSub, marginBottom: 12, lineHeight: 18 },
  loadingBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  error: { color: '#FFD3D3', fontSize: 13, textAlign: 'center', marginTop: 4 },
  signOut: { alignItems: 'center', marginTop: 16 },
  signOutText: { color: '#D8E7FA', fontSize: 13, textDecorationLine: 'underline' },
});
