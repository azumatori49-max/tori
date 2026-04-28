import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeJpeg } from 'jpeg-js';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// JPEG 画像 URI から、ONNX モデルが要求するテンソル形式のフロート配列へ変換するユーティリティ。
//
// パイプライン:
//   1. expo-image-manipulator で目標サイズへリサイズ + JPEG エンコード
//   2. ファイルを base64 で読み出して jpeg-js で RGBA ピクセル配列にデコード
//   3. RGB だけ抜き出して 0-1 正規化
//   4. NCHW 形式の Float32Array に並べ替え（ONNX の標準入力レイアウト）
//
// パフォーマンス注意:
//   - JS でのデコードは重い。640x640 で 100〜300ms。
//   - 96x96 の年齢推定なら 20〜50ms 程度。
//   - 将来的にネイティブモジュール化で 10倍速にできる余地あり。

export type ImageTensor = {
  data: Float32Array;
  width: number;
  height: number;
};

function base64ToUint8Array(b64: string): Uint8Array {
  // jpeg-js は Buffer or Uint8Array を受け取れるが React Native では Buffer がない。
  // 自前で base64 -> Uint8Array に変換する（軽量・依存ゼロ）。
  const cleaned = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const binary = globalThis.atob ? globalThis.atob(cleaned) : decodeBase64Manual(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeBase64Manual(b64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let str = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < b64.length; i++) {
    const ch = b64[i]!;
    if (ch === '=') break;
    const idx = chars.indexOf(ch);
    if (idx < 0) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      str += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return str;
}

// 元画像 URI から、指定サイズへリサイズ + JPEG 化したファイル URI を返す。
export async function resizeImage(
  uri: string,
  width: number,
  height: number,
): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width, height } }], {
    compress: 0.95,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

// JPEG ファイルを RGBA バイト配列にデコードする。
export async function loadJpegRgba(uri: string): Promise<{
  data: Uint8Array;
  width: number;
  height: number;
}> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToUint8Array(base64);
  const decoded = decodeJpeg(bytes, { useTArray: true });
  return {
    data: decoded.data,
    width: decoded.width,
    height: decoded.height,
  };
}

// RGBA ピクセルから NCHW 形式 Float32Array へ変換する。
// InsightFace 系は (1, 3, H, W), 値域 0-1 もしくは -1〜1（モデルにより異なる）。
// ここでは [0,1] 正規化を採用する。-1〜1 が必要なモデルなら呼び出し側で再スケールする。
export function rgbaToNchw(
  rgba: Uint8Array,
  width: number,
  height: number,
): Float32Array {
  const planeSize = width * height;
  const out = new Float32Array(3 * planeSize);
  for (let i = 0; i < planeSize; i++) {
    const r = rgba[i * 4]! / 255;
    const g = rgba[i * 4 + 1]! / 255;
    const b = rgba[i * 4 + 2]! / 255;
    out[i] = r;
    out[planeSize + i] = g;
    out[2 * planeSize + i] = b;
  }
  return out;
}

// 画像 URI を ONNX 入力テンソル（NCHW）に変換する一気通貫ユーティリティ。
export async function uriToTensor(
  uri: string,
  targetWidth: number,
  targetHeight: number,
): Promise<ImageTensor> {
  const resizedUri = await resizeImage(uri, targetWidth, targetHeight);
  const { data, width, height } = await loadJpegRgba(resizedUri);
  const tensor = rgbaToNchw(data, width, height);
  return { data: tensor, width, height };
}
