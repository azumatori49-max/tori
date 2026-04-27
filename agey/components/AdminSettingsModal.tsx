import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AdminSettings } from '../lib/settings';
import { DEFAULT_SETTINGS } from '../lib/settings';

type Props = {
  initial: AdminSettings;
  onSave: (s: AdminSettings) => void;
  onCancel: () => void;
};

type StepperProps = {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
};

function Stepper({ label, description, value, onChange, min, max }: StepperProps) {
  return (
    <View className="bg-white/5 rounded-2xl p-5 mb-4">
      <Text className="text-white text-lg font-bold mb-1">{label}</Text>
      <Text className="text-white/50 text-xs mb-4 leading-5">{description}</Text>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          className="bg-white/15 w-14 h-14 rounded-full items-center justify-center active:opacity-60"
        >
          <Text className="text-white text-3xl font-bold">−</Text>
        </Pressable>
        <View className="items-center">
          <Text className="text-white text-6xl font-black tabular-nums">{value}</Text>
          <Text className="text-white/40 text-xs">歳</Text>
        </View>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          className="bg-white/15 w-14 h-14 rounded-full items-center justify-center active:opacity-60"
        >
          <Text className="text-white text-3xl font-bold">＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AdminSettingsModal({ initial, onSave, onCancel }: Props) {
  const [hardBlock, setHardBlock] = useState(initial.hardBlockThreshold);
  const [idCheck, setIdCheck] = useState(initial.idCheckThreshold);
  const valid = hardBlock <= idCheck;

  return (
    <View className="absolute inset-0 bg-black">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-white text-2xl font-bold">管理者設定</Text>
              <Text className="text-white/50 text-xs mt-1">年齢ゲート閾値の調整</Text>
            </View>
            <Pressable
              onPress={onCancel}
              className="bg-white/10 px-4 py-2 rounded-full active:opacity-70"
            >
              <Text className="text-white text-sm">閉じる</Text>
            </Pressable>
          </View>

          <Stepper
            label="🛑 入店お断り判定"
            description="推定年齢の上限がこの値未満なら「入店お断り」として表示します。明らかな未成年を弾く閾値。"
            value={hardBlock}
            onChange={setHardBlock}
            min={10}
            max={30}
          />

          <Stepper
            label="🪪 身分証確認判定"
            description="推定年齢の下限がこの値未満なら「身分証ご提示ください」と表示します。グレーゾーン用。お断りより低くは設定できません。"
            value={idCheck}
            onChange={setIdCheck}
            min={10}
            max={40}
          />

          {!valid && (
            <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
              <Text className="text-red-300 text-xs">
                ⚠️ 「入店お断り」の値は「身分証確認」以下にしてください
              </Text>
            </View>
          )}

          <View className="bg-white/5 rounded-xl p-4 mb-6">
            <Text className="text-white/80 text-xs font-bold mb-2">判定ロジック</Text>
            <Text className="text-white/60 text-[11px] leading-5">
              推定上限 &lt; {hardBlock} → 🛑 入店お断り{'\n'}
              推定下限 &lt; {idCheck} → 🪪 身分証ご提示{'\n'}
              それ以外 → ✅ 通過
            </Text>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                setHardBlock(DEFAULT_SETTINGS.hardBlockThreshold);
                setIdCheck(DEFAULT_SETTINGS.idCheckThreshold);
              }}
              className="flex-1 bg-white/10 px-4 py-4 rounded-full active:opacity-80"
            >
              <Text className="text-white/80 text-center font-bold">初期値に戻す</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                valid &&
                onSave({
                  hardBlockThreshold: hardBlock,
                  idCheckThreshold: idCheck,
                })
              }
              disabled={!valid}
              className={`flex-1 px-4 py-4 rounded-full active:opacity-80 ${
                valid ? 'bg-emerald-500' : 'bg-white/10'
              }`}
            >
              <Text
                className={`text-center font-bold ${
                  valid ? 'text-white' : 'text-white/40'
                }`}
              >
                保存
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
