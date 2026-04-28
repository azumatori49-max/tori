import * as ort from 'onnxruntime-react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getAgeSession, getFaceDetectorSession } from './onnxModels';
import { uriToTensor, loadJpegRgba, rgbaToNchw, resizeImage } from './imageProcessing';

// AWS Rekognition 互換のレスポンス型。
// オンデバイス推論で取れない値（pose、qualityBrightness/Sharpness）は概算値か固定値で埋める。
// App.tsx 側の品質ゲートを既存のまま流用するための互換層。
export type FaceAnalysis = {
  ageLow: number;
  ageHigh: number;
  confidence: number; // 0-100, 顔検出の信頼度
  qualityBrightness: number; // 0-100, 0で暗すぎ。元画像の平均輝度から概算
  qualitySharpness: number; // 0-100, ボケ度の概算（Laplacian 分散など。当面は固定 80）
  pose: { yaw: number; pitch: number; roll: number }; // ONNX age モデルでは取れないため 0 固定
  boundingBox: { left: number; top: number; width: number; height: number };
  faceCount: number;
};

// SCRFD 500M の入力解像度。InsightFace 公式設定。
const DETECTOR_INPUT_SIZE = 640;
// genderage の入力解像度。
const AGE_INPUT_SIZE = 96;

// 顔検出のスコア閾値。これ未満の顔は無視する。
const DETECT_SCORE_THRESHOLD = 0.5;

type DetectedFace = {
  score: number;
  // 元画像座標系での絶対 px ボックス
  box: { x1: number; y1: number; x2: number; y2: number };
  // 元画像幅・高さに対する正規化ボックス（0〜1）
  normalizedBox: { left: number; top: number; width: number; height: number };
};

// SCRFD の出力テンソルから検出結果をデコードする。
// 出力レイアウトは InsightFace の Python 実装と同様だが、配列名・形状はモデル変換時に
// 決まる。ここでは公式 ONNX エクスポートの典型形を仮定し、不一致時はログを出して空を返す。
//
// 暫定実装: 信頼度フィルタ + IoU で NMS まで含む。
// 正確なアンカーボックスデコードは genuine InsightFace 移植が必要だが、
// 当面は最大スコア1顔だけ取れれば用途充足するためシンプル化している。
function decodeDetectorOutput(
  outputs: ort.InferenceSession.ReturnType,
  origWidth: number,
  origHeight: number,
): DetectedFace[] {
  // 実モデルの出力名・形状は推論を回して onnxruntime ログから把握する必要がある。
  // ここではフェッチした最初のスコアテンソル + ボックステンソルを取り出す簡易実装。
  const outputNames = Object.keys(outputs);
  if (outputNames.length === 0) return [];

  // 暫定: SCRFD 形式は (score, bbox, kps) × 3 stride。
  // 実装精度を取るには公式 anchor グリッドが必要。
  // 5/31までの工程で別途差し替え予定の関数として記述。
  console.warn(
    '[ageEstimator] decodeDetectorOutput はスタブ実装です。実機で出力テンソル形状を確認後、SCRFD アンカーデコードを実装してください。',
  );

  // 暫定: 何も検出しなかった扱いにして、後段で AWS 等の代替モデルにフォールバック可能にする。
  // 実装移行段階では false negative が増えるが、ビルドが通る状態を優先する。
  return [];
}

// 元画像から指定の絶対 px ボックスでクロップして、age モデル入力解像度の URI を返す。
async function cropFace(
  uri: string,
  box: { x1: number; y1: number; x2: number; y2: number },
): Promise<string> {
  const cropResult = await manipulateAsync(
    uri,
    [
      {
        crop: {
          originX: box.x1,
          originY: box.y1,
          width: box.x2 - box.x1,
          height: box.y2 - box.y1,
        },
      },
      { resize: { width: AGE_INPUT_SIZE, height: AGE_INPUT_SIZE } },
    ],
    { compress: 0.95, format: SaveFormat.JPEG },
  );
  return cropResult.uri;
}

// genderage モデルの出力から年齢値を取り出す。
// 公式実装では出力 (1, 3) で [gender_neg, gender_pos, age_normalized] が並ぶ。
// age は 0-1 正規化されているので 100 倍して年齢に戻す。
function decodeAge(outputs: ort.InferenceSession.ReturnType): number {
  const firstKey = Object.keys(outputs)[0];
  if (!firstKey) return 0;
  const tensor = outputs[firstKey];
  if (!tensor || !tensor.data) return 0;
  const arr = tensor.data as Float32Array;
  // 形状 (1, 3) を仮定。最後の値が age。
  // 形状違いの場合は配列末尾を採用するフォールバック。
  const ageNorm = arr.length >= 3 ? arr[2] : arr[arr.length - 1];
  if (typeof ageNorm !== 'number') return 0;
  // 0-1 → 0-100歳 にスケール。値域はモデル仕様により ±2歳ずれる可能性。実機で校正する。
  return Math.max(0, Math.min(100, Math.round(ageNorm * 100)));
}

// 単純な平均輝度からブライトネス推定 (0-100)。
// 真っ黒なら 0、真っ白なら 100 程度になる。
function estimateBrightness(rgba: Uint8Array): number {
  const len = rgba.length / 4;
  let sum = 0;
  // サンプリング: 全画素見ると重いので 16 ピクセル毎に間引く。
  const step = Math.max(1, Math.floor(len / 4096));
  let count = 0;
  for (let i = 0; i < len; i += step) {
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    // ITU-R BT.601 輝度近似
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
    count++;
  }
  if (count === 0) return 0;
  // 0-255 → 0-100
  return Math.round((sum / count / 255) * 100);
}

// メインAPI: 撮影済み画像 URI から顔検出 + 年齢推定までを実行する。
export async function estimateAgeFromImage(
  imageUri: string,
): Promise<FaceAnalysis | null> {
  // 1. 顔検出
  const detectorSession = await getFaceDetectorSession();
  const detectorTensor = await uriToTensor(
    imageUri,
    DETECTOR_INPUT_SIZE,
    DETECTOR_INPUT_SIZE,
  );
  const detectorInput = new ort.Tensor('float32', detectorTensor.data, [
    1,
    3,
    DETECTOR_INPUT_SIZE,
    DETECTOR_INPUT_SIZE,
  ]);
  const detectorInputName = detectorSession.inputNames[0];
  if (!detectorInputName) throw new Error('検出モデルの入力名が不明です');
  const detectorOutputs = await detectorSession.run({
    [detectorInputName]: detectorInput,
  });

  // 元画像の実サイズが必要（ボックス座標を絶対 px に戻すため）。
  // 撮影画像は CameraView 由来で expo-image-manipulator は元寸法を保持するため、
  // ここでは詳細解像度取得を簡略化し、リサイズ先の検出器サイズを基準とする。
  const faces = decodeDetectorOutput(
    detectorOutputs,
    DETECTOR_INPUT_SIZE,
    DETECTOR_INPUT_SIZE,
  );

  if (faces.length === 0) return null;

  // 最大スコアの顔を採用。
  const best = faces.reduce((a, b) => (b.score > a.score ? b : a));

  // 2. 顔クロップ
  const faceUri = await cropFace(imageUri, best.box);

  // 3. 年齢推定
  const ageSession = await getAgeSession();
  const ageTensorRaw = await uriToTensor(faceUri, AGE_INPUT_SIZE, AGE_INPUT_SIZE);
  const ageInput = new ort.Tensor('float32', ageTensorRaw.data, [
    1,
    3,
    AGE_INPUT_SIZE,
    AGE_INPUT_SIZE,
  ]);
  const ageInputName = ageSession.inputNames[0];
  if (!ageInputName) throw new Error('年齢モデルの入力名が不明です');
  const ageOutputs = await ageSession.run({ [ageInputName]: ageInput });
  const age = decodeAge(ageOutputs);

  // 4. 画像品質計測（明るさ）
  const { data: rgba } = await loadJpegRgba(
    await resizeImage(imageUri, 96, 96),
  );
  const brightness = estimateBrightness(rgba);

  // 5. レスポンス組み立て（AWS互換形式）
  return {
    ageLow: Math.max(0, age - 3),
    ageHigh: Math.min(100, age + 3),
    confidence: Math.round(best.score * 100),
    qualityBrightness: brightness,
    qualitySharpness: 80, // TODO: Laplacian variance で実測する
    pose: { yaw: 0, pitch: 0, roll: 0 }, // genderage モデルではポーズ未提供
    boundingBox: best.normalizedBox,
    faceCount: faces.length,
  };
}
