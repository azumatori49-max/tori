// キャリブレーション用データロガー。
//
// スタッフが ID 確認した実年齢と Rekognition の推定値をペアで保存することで、
// 後日まとめて補正式（実年齢 = α × Rekognition + β など）を導出するための土台。
//
// 動作:
//   - 必ず console.log にも出力する（開発時の確認用）
//   - EXPO_PUBLIC_LOG_ENDPOINT が設定されていれば、そこへ POST する
//     （Supabase REST、Webhook、自前 Lambda、何でも可）
//   - EXPO_PUBLIC_STORE_ID が設定されていれば店舗識別子として一緒に送る
//
// 失敗時はコンソール警告のみで握り潰す。本番化時は AsyncStorage に
// バッファして再送リトライする層を被せる予定。

export type Verdict = 'block' | 'id_check' | 'pass';

export type CalibrationEntry = {
  timestamp: string;
  storeId: string | null;
  rekognitionLow: number;
  rekognitionHigh: number;
  rekognitionMid: number;
  verdict: Verdict;
  actualAge: number;
  faceCount: number;
  qualityBrightness: number;
  qualitySharpness: number;
  poseYaw: number;
  posePitch: number;
  poseRoll: number;
};

export async function logCalibration(entry: CalibrationEntry): Promise<void> {
  // 必ず端末コンソールへ出力（開発・初期運用での確認用）。
  console.log('[CALIBRATION]', JSON.stringify(entry));

  const endpoint = process.env.EXPO_PUBLIC_LOG_ENDPOINT;
  if (!endpoint) return;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      console.warn('[CALIBRATION] non-OK response:', res.status);
    }
  } catch (e) {
    console.warn('[CALIBRATION] failed to send:', e);
  }
}
