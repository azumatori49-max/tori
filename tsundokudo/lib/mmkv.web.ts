/**
 * mmkv – Web フォールバック (localStorage)
 *
 * react-native-mmkv は Web 非対応のため、
 * localStorage ベースの互換実装を提供。
 */

const PREFIX = 'tsundokudo:';

const webStorage = {
  getString(key: string): string | undefined {
    return localStorage.getItem(PREFIX + key) ?? undefined;
  },
  set(key: string, value: string | number | boolean): void {
    localStorage.setItem(PREFIX + key, String(value));
  },
  getNumber(key: string): number | undefined {
    const v = localStorage.getItem(PREFIX + key);
    if (v == null) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  },
  getBoolean(key: string): boolean | undefined {
    const v = localStorage.getItem(PREFIX + key);
    if (v == null) return undefined;
    return v === 'true';
  },
  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  },
  clearAll(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  },
};

export const storage = webStorage;
