/**
 * 写真の取得ヘルパー
 *
 * 撮影／ライブラリから画像を選び、保存に強い「data URL（base64）」で返す。
 * data URL にすることで Web / ネイティブ どちらでも永続化でき、
 * ファイルURIの寿命問題を避けられる。
 *
 * 容量対策: 保存前に最大 1280px へ縮小し JPEG 60% に圧縮する。
 * （スマホ写真をそのまま base64 化すると1枚数MBになり、
 *   クラウド送信やストレージの上限を超えて保存に失敗するため）
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/** 長辺の最大ピクセル数 */
const MAX_DIMENSION = 1280;
/** JPEG圧縮率 */
const JPEG_QUALITY = 0.6;

const COMMON: ImagePicker.ImagePickerOptions = {
  quality: 1,
  allowsEditing: false,
};

/** 画像を縮小・圧縮して data URL にする */
async function toCompressedDataUrl(
  asset: ImagePicker.ImagePickerAsset,
): Promise<string | null> {
  try {
    const w = asset.width ?? 0;
    const h = asset.height ?? 0;
    const needsResize = Math.max(w, h) > MAX_DIMENSION;
    const actions: ImageManipulator.Action[] = needsResize
      ? [w >= h ? { resize: { width: MAX_DIMENSION } } : { resize: { height: MAX_DIMENSION } }]
      : [];
    const result = await ImageManipulator.manipulateAsync(asset.uri, actions, {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (result.base64) {
      return `data:image/jpeg;base64,${result.base64}`;
    }
    return result.uri ?? null;
  } catch {
    // 圧縮に失敗した場合は元のURIをそのまま使う（保存は試みる）
    return asset.uri ?? null;
  }
}

async function pickResult(result: ImagePicker.ImagePickerResult): Promise<string | null> {
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  return toCompressedDataUrl(asset);
}

/** カメラで撮影して data URL を返す（許可なし/キャンセル時は null） */
export async function capturePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync(COMMON);
  return pickResult(result);
}

/** ライブラリ／ファイルから選択して data URL を返す */
export async function selectPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  // Web では許可ダイアログがなく granted=false でもファイル選択は可能
  if (!perm.granted && Platform.OS !== 'web') return null;
  const result = await ImagePicker.launchImageLibraryAsync(COMMON);
  return pickResult(result);
}

/** カメラ撮影に対応している環境か（Web はファイル選択のみにする） */
export const CAMERA_SUPPORTED = Platform.OS !== 'web';
