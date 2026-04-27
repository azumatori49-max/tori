import AsyncStorage from '@react-native-async-storage/async-storage';
import { HARD_BLOCK_THRESHOLD, ID_CHECK_THRESHOLD } from '../constants/config';

// 管理者が画面から調整できる年齢ゲート閾値の永続化レイヤ。
// AsyncStorage に JSON で保存。ファースト起動時はデフォルト値を返す。

const STORAGE_KEY = '@agey/adminSettings/v1';

export type AdminSettings = {
  hardBlockThreshold: number;
  idCheckThreshold: number;
};

export const DEFAULT_SETTINGS: AdminSettings = {
  hardBlockThreshold: HARD_BLOCK_THRESHOLD,
  idCheckThreshold: ID_CHECK_THRESHOLD,
};

function sanitize(raw: unknown): AdminSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const obj = raw as Record<string, unknown>;
  return {
    hardBlockThreshold:
      typeof obj.hardBlockThreshold === 'number'
        ? obj.hardBlockThreshold
        : DEFAULT_SETTINGS.hardBlockThreshold,
    idCheckThreshold:
      typeof obj.idCheckThreshold === 'number'
        ? obj.idCheckThreshold
        : DEFAULT_SETTINGS.idCheckThreshold,
  };
}

export async function loadSettings(): Promise<AdminSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return sanitize(JSON.parse(raw));
  } catch (e) {
    console.warn('[settings] load failed, using defaults:', e);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AdminSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
