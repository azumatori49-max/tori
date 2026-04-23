import { CONFIG } from '@/constants/config';

type AzureFace = {
  faceAttributes?: { age?: number };
};

export async function estimateAgeFromPhoto(photoPath: string): Promise<number> {
  if (CONFIG.DEV_MOCK_ESTIMATOR) {
    await new Promise((r) => setTimeout(r, 800));
    return Math.round(25 + Math.random() * 30); // 25〜55のランダム値（開発用）
  }

  const fileUri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;

  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('ファイル読み込み失敗'));
    xhr.open('GET', fileUri);
    xhr.send();
  });

  const url =
    `${CONFIG.AZURE_FACE_ENDPOINT}/face/v1.0/detect` +
    `?returnFaceAttributes=age&detectionModel=detection_03&recognitionModel=recognition_04`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Ocp-Apim-Subscription-Key': CONFIG.AZURE_FACE_KEY,
    },
    body: blob,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure API ${response.status}: ${text.slice(0, 200)}`);
  }

  const faces = (await response.json()) as AzureFace[];
  const age = faces[0]?.faceAttributes?.age;
  if (age == null) throw new Error('顔が検出されませんでした');
  return age;
}
