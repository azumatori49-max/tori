import { Text, View } from 'react-native';

export function PrivacyNote() {
  return (
    <View className="rounded-xl bg-white/5 px-4 py-3">
      <Text className="text-center text-xs text-white/60">
        映像は端末内でのみ処理され、保存・送信は行いません
      </Text>
    </View>
  );
}
