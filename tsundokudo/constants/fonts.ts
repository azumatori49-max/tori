import { Platform } from 'react-native';

/**
 * アプリ全体のフォント（游ゴシック）。
 *
 * - iOS: 游ゴシック（"YuGothic"）が標準搭載
 * - Web: global.css 側で游ゴシック系を指定（ここは未指定でOK）
 * - Android: 游ゴシックは標準搭載されていないため端末標準（Noto Sans CJK）に
 *   フォールバックする
 */
export const FONT_FAMILY = Platform.select({
  ios: 'YuGothic',
  default: undefined,
});
