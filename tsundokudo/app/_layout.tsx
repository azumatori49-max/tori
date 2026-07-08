import '../global.css';
import { useEffect } from 'react';
import { ActivityIndicator, LogBox, Platform, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';
import { useAuthStore } from '@/store/authStore';
import { isCloudEnabled } from '@/lib/firebase';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { OrgSetupScreen } from '@/components/auth/OrgSetupScreen';
import { C } from '@/constants/colors';

// Web プレビュー時のネイティブモジュール系エラーを抑制
LogBox.ignoreAllLogs(true);

/** Web: Noto Sans JP を Google Fonts から読み込む */
function loadWebFont() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const id = 'noto-sans-jp-font';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800&display=swap';
  document.head.appendChild(link);
}

function MainStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="report/[id]" options={{ presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const pathname = usePathname();
  const hydrate = useReportStore((s) => s.hydrate);
  const authInit = useAuthStore((s) => s.init);
  const authReady = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);
  const orgChecked = useAuthStore((s) => s.orgChecked);
  const guestOrg = useAuthStore((s) => s.guestOrg);

  // 起動時
  useEffect(() => {
    loadWebFont();
    if (isCloudEnabled) {
      void authInit();
    } else {
      void hydrate();
    }
  }, [authInit, hydrate]);

  // クラウド時: ログイン／閲覧モードに応じてデータを読み込み／クリア
  useEffect(() => {
    if (!isCloudEnabled) return;
    if ((user && org) || guestOrg) {
      void hydrate();
    } else {
      // サインアウト時はメモリ上のデータをクリア
      useReportStore.setState({ reports: [], hydrated: false });
    }
  }, [user, org, guestOrg, hydrate]);

  // 閲覧用リンク（/v/xxx）は未ログインでも開ける
  const isViewerRoute = pathname?.startsWith('/v/') ?? false;

  let content: React.ReactNode;
  if (isCloudEnabled && (!authReady || (user && !orgChecked))) {
    content = (
      <View style={{ flex: 1, backgroundColor: C.headerBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  } else if (isCloudEnabled && !user && !guestOrg && !isViewerRoute) {
    content = <LoginScreen />;
  } else if (isCloudEnabled && user && !org) {
    content = <OrgSetupScreen />;
  } else {
    content = <MainStack />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {content}
    </SafeAreaProvider>
  );
}
