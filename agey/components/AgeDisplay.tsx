import { Text, View } from 'react-native';

type Props = {
  age: number | null;
  pending: boolean;
};

export function AgeDisplay({ age, pending }: Props) {
  if (pending || age === null) {
    return (
      <View className="items-center">
        <Text className="text-xl text-white/60">顔をカメラに向けてください</Text>
      </View>
    );
  }

  const rounded = Math.round(age);
  return (
    <View className="items-center">
      <Text className="text-xl text-white/70">推定年齢</Text>
      <View className="mt-2 flex-row items-end">
        <Text className="text-[144px] font-bold leading-none text-white">{rounded}</Text>
        <Text className="mb-6 ml-2 text-4xl text-white/80">歳</Text>
      </View>
    </View>
  );
}
