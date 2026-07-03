import './global.css';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

// 注: 実体のエントリは expo-router (app/ ディレクトリ)。本ファイルは未使用。
export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-800">らくらく店舗メンテナンス</Text>
      <StatusBar style="auto" />
    </View>
  );
}
