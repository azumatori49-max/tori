/**
 * ログイン画面（クラウド有効時、未ログインなら表示）
 *
 * - 担当者: メールアドレス＋パスワード
 * - 閲覧（店長）: 閲覧コード（合言葉）のみ。メールアドレス不要
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

type Mode = 'staff' | 'viewer';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signIn);
  const signInWithCode = useAuthStore((s) => s.signInWithCode);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [mode, setMode] = useState<Mode>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  function switchMode(m: Mode) {
    setMode(m);
    clearError();
  }

  async function onSubmit() {
    if (mode === 'staff') {
      if (!email.trim() || !password) return;
      await signIn(email, password);
    } else {
      if (!code.trim()) return;
      await signInWithCode(code);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        <View style={styles.brand}>
          <View style={styles.logoWrap}>
            <Image source={logoAsset} style={styles.logo} contentFit="contain" />
          </View>
          <Text style={styles.title}>らくらく店舗メンテナンス</Text>
          <Text style={styles.sub}>定期点検・作業記録</Text>
        </View>

        <View style={styles.card}>
          {/* モード切替 */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, mode === 'staff' && styles.tabActive]}
              onPress={() => switchMode('staff')}
            >
              <Text style={[styles.tabText, mode === 'staff' && styles.tabTextActive]}>
                担当者
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, mode === 'viewer' && styles.tabActive]}
              onPress={() => switchMode('viewer')}
            >
              <Text style={[styles.tabText, mode === 'viewer' && styles.tabTextActive]}>
                閲覧（店長）
              </Text>
            </Pressable>
          </View>

          {mode === 'staff' ? (
            <>
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
            </>
          ) : (
            <>
              <Field label="閲覧コード">
                <Input
                  value={code}
                  onChangeText={setCode}
                  placeholder="閲覧コードを入力"
                  autoCapitalize="none"
                />
              </Field>
              <Text style={styles.viewerNote}>
                閲覧コードは施工担当者から共有されます。{'\n'}
                レポートの閲覧・PDF出力のみ可能です。
              </Text>
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={{ height: 6 }} />
          {loading ? (
            <View style={styles.loadingBtn}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <Button
              title={mode === 'staff' ? 'ログイン' : '閲覧をはじめる'}
              onPress={() => void onSubmit()}
            />
          )}
        </View>

        <Text style={styles.note}>
          {mode === 'staff'
            ? 'アカウントは管理者が発行します。\nログインできない場合は管理者へお問い合わせください。'
            : '閲覧コードが分からない場合は施工担当者へお問い合わせください。'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.headerBg },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F7',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 14, fontWeight: '600', color: C.textSub },
  tabTextActive: { color: C.primaryDark, fontWeight: '800' },
  viewerNote: { fontSize: 12, color: C.textSub, lineHeight: 18, marginBottom: 4 },
  error: { color: C.danger, fontSize: 13, marginTop: 2 },
  loadingBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  note: { color: '#D8E7FA', fontSize: 12, textAlign: 'center', marginTop: 22, lineHeight: 18 },
});
