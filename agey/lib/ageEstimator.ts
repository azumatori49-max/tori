import { CONFIG } from '@/constants/config';
import type { AgeEstimate, FaceBox } from '@/types/agey';

/**
 * 年齢推定器。
 *
 * 実運用では TFLite モデル (MiVOLO / SSR-Net など量子化版) を
 * react-native-fast-tflite で推論させる。モデル未配置時は
 * 顔バウンディングボックスから擬似年齢を返す開発用モックに
 * フォールバックする (CONFIG.DEV_MOCK_ESTIMATOR を参照)。
 *
 * モデル配置手順:
 *   1. assets/models/age_model.tflite を配置
 *   2. CONFIG.DEV_MOCK_ESTIMATOR = false に変更
 *   3. useAgeEstimator を差し替え (コメント参照)
 */

export type AgeEstimator = {
  estimate: (face: FaceBox, frameWidth: number) => AgeEstimate | null;
};

/**
 * 顔サイズから擬似年齢を返す開発用モック。
 * 顔が大きく映っている → 近い距離 → 表情変化が大きいほど揺らす。
 * 年齢推定ロジック自体の検証には使わず、UIと配線確認のみに使う。
 */
export function createMockEstimator(): AgeEstimator {
  let frameCounter = 0;
  return {
    estimate(face, frameWidth) {
      frameCounter += 1;
      const ratio = face.width / Math.max(frameWidth, 1);
      // 顔比率 0.15 → ~35歳, 0.35 → ~22歳 あたりに雑にマップ
      const base = Math.round(50 - ratio * 90);
      const jitter = Math.sin(frameCounter / 3) * 2;
      const age = Math.max(10, Math.min(70, base + jitter));
      return {
        age,
        confidence: 0.5,
        detectedAt: Date.now(),
      };
    },
  };
}

/**
 * 実モデル用の雛形 (有効化する際はコメントを外す)。
 *
 * import { useTensorflowModel } from 'react-native-fast-tflite';
 *
 * export function useRealEstimator(): AgeEstimator | null {
 *   const model = useTensorflowModel(require('../assets/models/age_model.tflite'));
 *   if (model.state !== 'loaded') return null;
 *   return {
 *     estimate(face, frameWidth) {
 *       // TODO: face 領域を切り出して正規化し model.runSync([input]) で推論
 *       //       モデルの出力フォーマットに合わせて age を算出する
 *       return null;
 *     },
 *   };
 * }
 */

/** DEV_MOCK_ESTIMATOR フラグで切り替える簡易ファクトリ */
export function createEstimator(): AgeEstimator {
  if (CONFIG.DEV_MOCK_ESTIMATOR) {
    return createMockEstimator();
  }
  throw new Error(
    'Real TFLite estimator is not wired. Set CONFIG.DEV_MOCK_ESTIMATOR=true or implement useRealEstimator in lib/ageEstimator.ts',
  );
}
