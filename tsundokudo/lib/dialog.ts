/**
 * クロスプラットフォームのダイアログ。
 *
 * react-native の Alert は Web（react-native-web）では動作しない（無反応になる）。
 * Web では window.alert / window.confirm にフォールバックする。
 */
import { Alert, Platform } from 'react-native';

/** 通知（OKのみ） */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** 確認（OK/キャンセル）。OKで true。 */
export function confirmAsync(
  title: string,
  message?: string,
  confirmText = 'OK',
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
