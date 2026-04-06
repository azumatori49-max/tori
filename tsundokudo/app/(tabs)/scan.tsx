import { Text, View } from 'react-native';

export default function ScanScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-stone-900">
      <Text className="text-2xl">📷</Text>
      <Text className="mt-2 text-base text-stone-400">ISBN スキャン（実装予定）</Text>
    </View>
  );
}
