import './global.css';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-800">積読道</Text>
      <Text className="mt-2 text-base text-gray-500">Tsundokudo</Text>
      <StatusBar style="auto" />
    </View>
  );
}
