import '../global.css';
import { useEffect } from 'react';
import { LogBox, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useReportStore } from '@/store/reportStore';

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

export default function RootLayout() {
  const hydrate = useReportStore((s) => s.hydrate);

  useEffect(() => {
    loadWebFont();
    void hydrate();
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="report/[id]" options={{ presentation: 'card' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
