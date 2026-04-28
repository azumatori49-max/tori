import { Asset } from 'expo-asset';
import * as ort from 'onnxruntime-react-native';

// ONNX モデルファイルのアセット登録 + 推論セッションの遅延初期化を行う。
//
// 暫定段階:
//   - 顔検出 (scrfd_500m.onnx) は未統合。warmupModels では年齢モデルのみ温める。
//   - SCRFD のアンカーデコード実装と一緒に getFaceDetectorSession を有効化する。
//
// モデルファイル配置:
//   assets/models/genderage.onnx    ← 年齢・性別推定 (InsightFace genderage)
//   assets/models/scrfd_500m.onnx   ← 顔検出 (将来用、現状未使用)
//
// 入手元・配置手順は assets/models/README.md を参照。

let ageSessionPromise: Promise<ort.InferenceSession> | null = null;

async function loadModelToLocalUri(assetModule: number): Promise<string> {
  const asset = Asset.fromModule(assetModule);
  if (!asset.localUri) {
    await asset.downloadAsync();
  }
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('モデルアセットの URI 取得に失敗しました');
  // expo-asset は file:// プレフィックスを付けて返すが、
  // onnxruntime-react-native はパスのみを受け付けるため除去する。
  return uri.replace(/^file:\/\//, '');
}

export function getAgeSession(): Promise<ort.InferenceSession> {
  if (!ageSessionPromise) {
    ageSessionPromise = (async () => {
      const path = await loadModelToLocalUri(
        require('../assets/models/genderage.onnx'),
      );
      return ort.InferenceSession.create(path);
    })();
  }
  return ageSessionPromise;
}

// 起動時に年齢モデルを先読みして、最初のスキャン時のレイテンシを抑える。
export async function warmupModels(): Promise<void> {
  await getAgeSession();
}
