import { Tabs } from 'expo-router';

import { C } from '@/constants/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textFaint,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
        // アイコンは使わない（未指定だと react-navigation のプレースホルダが出るため明示的に無効化）
        tabBarIcon: () => null,
      }}
    >
      <Tabs.Screen name="reports" options={{ title: 'レポート' }} />
      <Tabs.Screen name="stores" options={{ title: '店舗' }} />
      <Tabs.Screen name="settings" options={{ title: '設定' }} />
    </Tabs>
  );
}
