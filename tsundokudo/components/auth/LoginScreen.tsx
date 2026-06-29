/**
 * ログイン画面（クラウド有効時、未ログインなら表示）
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/authStore';
import { Button, Field, Input } from '@/components/ui';
import { C } from '@/constants/colors';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit() {
    if (!email.trim() || !password) return;
    await signIn(email, password);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        <View style={styles.brand}>
          <Text style={styles.title}>メンテナンスレポート</Text>
          <Text style={styles.sub}>衛生管理・定期点検</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ログイン</Text>
          <Field label="メールアドレス">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="example@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </Field>
          <Field label="パスワード">
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="パスワード"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />
          </Field>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={{ height: 6 }} />
          {loading ? (
            <View style={styles.loadingBtn}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <Button title="ログイン" onPress={() => void onSubmit()} />
          )}
        </View>

        <Text style={styles.note}>
          アカウントは管理者が発行します。{'\n'}ログインできない場合は管理者へお問い合わせください。
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.headerBg },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 28 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#D6F2EE', fontSize: 13, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 14 },
  error: { color: C.danger, fontSize: 13, marginTop: 2 },
  loadingBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  note: { color: '#D6F2EE', fontSize: 12, textAlign: 'center', marginTop: 22, lineHeight: 18 },
});
