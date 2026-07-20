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
import { DefaultsSetupScreen } from '@/components/auth/DefaultsSetupScreen';
import { PendingScreen } from '@/components/auth/PendingScreen';
import { isOperatorUser } from '@/lib/operator';
import { C } from '@/constants/colors';

// Web プレビュー時のネイティブモジュール系エラーを抑制
LogBox.ignoreAllLogs(true);

/** Web: ホーム画面追加用のアイコン・名前を設定（iOS/Android） */
function setupWebAppIcons() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('rr-touch-icon')) return;
  // GitHub Pages はサブパス /tori 配下で配信される
  const prefix = window.location.hostname.endsWith('github.io') ? '/tori' : '';
  const add = (tag: 'link' | 'meta', attrs: Record<string, string>) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  };
  add('link', { id: 'rr-touch-icon', rel: 'apple-touch-icon', sizes: '180x180', href: `${prefix}/apple-touch-icon.png` });
  add('link', { rel: 'manifest', href: `${prefix}/manifest.json` });
  add('meta', { name: 'apple-mobile-web-app-title', content: 'らくらくメンテ' });
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'theme-color', content: '#1565D8' });
}

/** Web: ブラウザの自動翻訳を無効化（UI文言が別の文に書き換わる誤動作を防ぐ） */
function disableAutoTranslate() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');
  document.documentElement.setAttribute('lang', 'ja');
  if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
    const meta = document.createElement('meta');
    meta.name = 'google';
    meta.content = 'notranslate';
    document.head.appendChild(meta);
  }
}

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
  const hydrateSettings = useReportStore((s) => s.hydrateSettings);
  const settingsLoaded = useReportStore((s) => s.settingsLoaded);
  const setupDone = useReportStore((s) => s.settings.setupDone);
  const authInit = useAuthStore((s) => s.init);
  const authReady = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const org = useAuthStore((s) => s.org);
  const orgChecked = useAuthStore((s) => s.orgChecked);
  const guestOrg = useAuthStore((s) => s.guestOrg);

  // 起動時
  useEffect(() => {
    disableAutoTranslate();
    setupWebAppIcons();
    loadWebFont();
    if (isCloudEnabled) {
      void authInit();
    } else {
      void hydrate();
    }
  }, [authInit, hydrate]);

  // クラウド時: 設定（マスタ）はログイン後すぐ読み込む（初期設定画面の判定用）
  useEffect(() => {
    if (isCloudEnabled && user) void hydrateSettings();
  }, [user, hydrateSettings]);

  // クラウド時: ログイン／閲覧モードに応じてデータを読み込み／クリア
  useEffect(() => {
    if (!isCloudEnabled) return;
    // 承認待ちの組織はデータ取得しない（ルールで拒否されるため）
    if ((user && org && (org.active || isOperatorUser(user))) || guestOrg) {
      void hydrate();
    } else {
      // サインアウト時はメモリ上のデータをクリア
      useReportStore.setState({ reports: [], hydrated: false });
    }
  }, [user, org, guestOrg, hydrate]);

  // 閲覧用リンク（/v/xxx）は未ログインでも開ける
  const isViewerRoute = pathname?.startsWith('/v/') ?? false;

  let content: React.ReactNode;
  if (isCloudEnabled && (!authReady || (user && !orgChecked) || (user && org && !settingsLoaded))) {
    content = (
      <View style={{ flex: 1, backgroundColor: C.headerBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  } else if (isCloudEnabled && !user && !guestOrg && !isViewerRoute) {
    content = <LoginScreen />;
  } else if (isCloudEnabled && user && !org) {
    content = <OrgSetupScreen />;
  } else if (isCloudEnabled && user && org?.role === 'admin' && !setupDone) {
    // 会社登録直後: レポートの既定値をまず決めてもらう
    content = <DefaultsSetupScreen />;
  } else if (isCloudEnabled && user && org && !org.active && !isOperatorUser(user)) {
    // 運営の利用開始承認待ち（請求書払いの承認制）
    content = <PendingScreen />;
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
