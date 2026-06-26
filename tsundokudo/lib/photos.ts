/**
 * 写真の取得ヘルパー
 *
 * 撮影／ライブラリから画像を選び、保存に強い「data URL（base64）」で返す。
 * data URL にすることで Web / ネイティブ どちらでも MMKV / localStorage に
 * そのまま永続化でき、ファイルURIの寿命問題を避けられる。
 *
 * 注: base64 はストレージを消費するため、画質を落として保持している。
 *     本格運用では端末ファイル or クラウド(Storage)保存へ移行するのが望ましい。
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const COMMON: ImagePicker.ImagePickerOptions = {
  base64: true,
  quality: 0.4,
  allowsEditing: false,
};

function toDataUrl(result: ImagePicker.ImagePickerResult): string | null {
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  if (asset.base64) {
    const mime = asset.mimeType ?? 'image/jpeg';
    return `data:${mime};base64,${asset.base64}`;
  }
  // base64 が取れない環境では URI をそのまま返す（フォールバック）
  return asset.uri ?? null;
}

/** カメラで撮影して data URL を返す（許可なし/キャンセル時は null） */
export async function capturePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync(COMMON);
  return toDataUrl(result);
}

/** ライブラリ／ファイルから選択して data URL を返す */
export async function selectPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  // Web では許可ダイアログがなく granted=false でもファイル選択は可能
  if (!perm.granted && Platform.OS !== 'web') return null;
  const result = await ImagePicker.launchImageLibraryAsync(COMMON);
  return toDataUrl(result);
}

/** カメラ撮影に対応している環境か（Web はファイル選択のみにする） */
export const CAMERA_SUPPORTED = Platform.OS !== 'web';
