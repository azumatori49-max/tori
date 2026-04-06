import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1C1008',
          borderTopColor: '#3A2010',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#D97706',
        tabBarInactiveTintColor: '#78716C',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="shelf"
        options={{
          title: '本棚',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tower"
        options={{
          title: '積読タワー',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗼" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: '追加',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📷" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
