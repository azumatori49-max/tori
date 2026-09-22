import { createMMKV } from 'react-native-mmkv';

// react-native-mmkv v4 では new MMKV() ではなく createMMKV() を使う
export const storage = createMMKV({
  id: 'tsundokudo-storage',
  encryptionKey: 'tsundokudo-secret',
});
