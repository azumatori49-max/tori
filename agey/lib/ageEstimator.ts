import * as ort from 'onnxruntime-react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getAgeSession } from './onnxModels';
import { uriToTensor, loadJpegRgba, resizeImage } from './imageProcessing';

// AWS Rekognition 互換のレスポンス型。
// オンデバイス推論で取れない値（pose、qualitySharpness）は概算値か固定値で埋める。
export type FaceAnalysis = {
  ageLow: number;
  ageHigh: number;
  confidence: number;
  qualityBrightness: number;
  qualitySharpness: number;
  pose: { yaw: number; pitch: number; roll: number };
  boundingBox: { left: number; top: number; width: number; height: number };
  faceCount: number;
};

// genderage モデル入力解像度（InsightFace 標準）。
const AGE_INPUT_SIZE = 96;

// FaceFrame コンポーネントが描画する楕円枠と一致させた、画像中央の固定クロップ領域。
// SCRFD による顔検出が未実装の暫定段階で、ユーザに枠内へ顔を入れてもらう運用に依存する。
// 本番化時は scrfd_500m.onnx で動的に検出する関数 (decodeDetectorOutput) に差し替える。
const CENTER_CROP_RATIO = 0.7; // 画像幅に対する横クロップ比
const CENTER_CROP_ASPECT = 1.3; // 縦/横 比率（楕円枠と同じ）
const CENTER_CROP_VERTICAL_OFFSET = -0.05; // 枠が中央より上に40pxある分、わずかに上寄せ

// genderage モデルの出力から年齢値を取り出す。
// 公式実装では出力 (1, 3) で [gender_neg, gender_pos, age_normalized] が並ぶ。
// age は 0-1 正規化されているので 100 倍して年齢に戻す。
function decodeAge(outputs: ort.InferenceSession.ReturnType): number {
  const firstKey = Object.keys(outputs)[0];
  if (!firstKey) return 0;
  const tensor = outputs[firstKey];
  if (!tensor || !tensor.data) return 0;
  const arr = tensor.data as Float32Array;
  const ageNorm = arr.length >= 3 ? arr[2] : arr[arr.length - 1];
  if (typeof ageNorm !== 'number') return 0;
  return Math.max(0, Math.min(100, Math.round(ageNorm * 100)));
}

// 平均輝度から brightness 推定 (0-100)。
function estimateBrightness(rgba: Uint8Array): number {
  const len = rgba.length / 4;
  if (len === 0) return 0;
  let sum = 0;
  const step = Math.max(1, Math.floor(len / 4096));
  let count = 0;
  for (let i = 0; i < len; i += step) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
    count++;
  }
  if (count === 0) return 0;
  return Math.round((sum / count / 255) * 100);
}

// 元画像 URI から、楕円枠相当の中央領域をクロップしてリサイズした URI を返す。
async function cropCenterOval(
  uri: string,
  imageWidth: number,
  imageHeight: number,
): Promise<string> {
  const cropWidth = Math.floor(imageWidth * CENTER_CROP_RATIO);
  const cropHeight = Math.floor(cropWidth * CENTER_CROP_ASPECT);
  const cropX = Math.floor((imageWidth - cropWidth) / 2);
  const cropY = Math.floor(
    (imageHeight - cropHeight) / 2 + imageHeight * CENTER_CROP_VERTICAL_OFFSET,
  );
  const result = await manipulateAsync(
    uri,
    [
      {
        crop: {
          originX: Math.max(0, cropX),
          originY: Math.max(0, cropY),
          width: Math.min(cropWidth, imageWidth - cropX),
          height: Math.min(cropHeight, imageHeight - cropY),
        },
      },
      { resize: { width: AGE_INPUT_SIZE, height: AGE_INPUT_SIZE } },
    ],
    { compress: 0.95, format: SaveFormat.JPEG },
  );
  return result.uri;
}

// メインAPI: 撮影済み画像 URI から推定年齢を返す。
//
// 暫定実装メモ:
//   - 顔検出 (SCRFD) は未統合。代わりに「画面中央の楕円枠領域」を顔とみなして
//     固定クロップする。ユーザに枠内へ顔を入れてもらう運用前提。
//   - 顔が枠の外にあっても false positive で年齢を返してしまうため、本番化時には
//     SCRFD 統合とともに「顔が見つからなかった場合は null を返す」ロジックを復活させる。
export async function estimateAgeFromImage(
  imageUri: string,
): Promise<FaceAnalysis | null> {
  // 元画像のサイズを取得するために一度生のまま読み込む。
  // 撮影サイズは端末依存なので、JPEG ヘッダから幅・高さを取り出すのが正攻法。
  // ここでは jpeg-js の decode 経由で得られるサイズを使う。
  const rawJpeg = await loadJpegRgba(imageUri);
  const { width: imageWidth, height: imageHeight } = rawJpeg;

  // 1. 楕円枠相当を中央クロップして 96x96 化。
  const faceUri = await cropCenterOval(imageUri, imageWidth, imageHeight);

  // 2. ONNX age モデルで推定。
  const ageSession = await getAgeSession();
  const tensor = await uriToTensor(faceUri, AGE_INPUT_SIZE, AGE_INPUT_SIZE);
  const input = new ort.Tensor('float32', tensor.data, [
    1,
    3,
    AGE_INPUT_SIZE,
    AGE_INPUT_SIZE,
  ]);
  const inputName = ageSession.inputNames[0];
  if (!inputName) throw new Error('年齢モデルの入力名が不明です');
  const outputs = await ageSession.run({ [inputName]: input });
  const age = decodeAge(outputs);

  // 3. 画像品質計測（明るさ）。
  const { data: rgbaSmall } = await loadJpegRgba(
    await resizeImage(imageUri, 96, 96),
  );
  const brightness = estimateBrightness(rgbaSmall);

  // 4. 中央クロップ前提の暫定 boundingBox（画像中央 70% × 91%）。
  const centerBox = {
    left: (1 - CENTER_CROP_RATIO) / 2,
    top: (1 - CENTER_CROP_RATIO * CENTER_CROP_ASPECT) / 2,
    width: CENTER_CROP_RATIO,
    height: CENTER_CROP_RATIO * CENTER_CROP_ASPECT,
  };

  return {
    ageLow: Math.max(0, age - 3),
    ageHigh: Math.min(100, age + 3),
    confidence: 95, // 暫定: 中央クロップ前提なので固定値
    qualityBrightness: brightness,
    qualitySharpness: 80, // TODO: Laplacian variance で実測
    pose: { yaw: 0, pitch: 0, roll: 0 },
    boundingBox: centerBox,
    faceCount: 1,
  };
}
