/**
 * ログイン／新規登録画面（クラウド有効時、未ログインなら表示）
 *
 * - 担当者: メールアドレス＋パスワードでログイン、または新規登録
 * - 店長など閲覧のみの方: 担当者から共有される「閲覧用リンク」から開く（ログイン不要）
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
import { notify } from '@/lib/dialog';
import { Button, Field, Input } from '@/components/ui';
import { C } from '@/constants/colors';
import logoAsset from '@/assets/logo.png';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const clearError = useAuthStore((s) => s.clearError);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    clearError();
  }

  async function onForgotPassword() {
    if (!email.trim()) {
      notify('メールアドレスを入力してください', '上の欄にログイン用のメールアドレスを入力してから押してください。');
      return;
    }
    const ok = await resetPassword(email);
    if (ok) {
      notify(
        '再設定メールを送りました',
        `${email.trim()} 宛にパスワード再設定メールを送りました。\nメール内のリンクから新しいパスワードを設定して、もう一度ログインしてください。\n（届かない場合は迷惑メールフォルダも確認してください）`,
      );
    }
  }

  async function onSubmit() {
    if (!email.trim() || !password) return;
    // 登録・ログインに成功すると認証リスナー経由で自動的に画面が切り替わる
    if (mode === 'login') {
      await signIn(email, password);
    } else {
      await signUp(email, password);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logoWrap}>
            <Image source={logoAsset} style={styles.logo} contentFit="contain" />
          </View>
          <Text style={styles.title}>らくらく店舗メンテナンス</Text>
          <Text style={styles.sub}>定期点検・施工記録</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {mode === 'login' ? 'ログイン' : '新規登録'}
          </Text>
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
              placeholder={mode === 'signup' ? '6文字以上' : 'パスワード'}
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
            <Button
              title={mode === 'login' ? 'ログイン' : '登録して始める'}
              onPress={() => void onSubmit()}
            />
          )}

          {mode === 'login' && (
            <Pressable style={styles.switchBtn} onPress={() => void onForgotPassword()}>
              <Text style={styles.switchText}>パスワードを忘れた方はこちら（再設定メールを送る）</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.switchBtn}
            onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          >
            <Text style={styles.switchText}>
              {mode === 'login'
                ? 'アカウントをお持ちでない方はこちら（新規登録）'
                : 'すでにアカウントをお持ちの方はこちら（ログイン）'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          閲覧のみの方（店長など）はログイン不要です。{'\n'}
          担当者から共有される「閲覧用リンク」を開いてください。
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.headerBg },
  inner: { padding: 24, paddingBottom: 48 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logo: { width: 78, height: 78 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#D8E7FA', fontSize: 13, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 14 },
  error: { color: C.danger, fontSize: 13, marginTop: 2 },
  info: { color: C.primaryDark, fontSize: 13, marginTop: 2, lineHeight: 19 },
  loadingBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  switchBtn: { alignItems: 'center', marginTop: 14 },
  switchText: { color: C.primary, fontSize: 13, textDecorationLine: 'underline' },
  note: { color: '#D8E7FA', fontSize: 12, textAlign: 'center', marginTop: 22, lineHeight: 18 },
});
