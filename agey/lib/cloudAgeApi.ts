import { CONFIG } from '@/constants/config';

export async function estimateAgeFromPhoto(photoPath: string): Promise<number> {
  if (CONFIG.DEV_MOCK_ESTIMATOR) {
    await new Promise((r) => setTimeout(r, 800));
    return Math.round(25 + Math.random() * 30);
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

  // プロキシサーバーを経由して呼ぶ。Azure キーはサーバー側にのみ存在する。
  const response = await fetch(CONFIG.AGE_API_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`プロキシエラー ${response.status}: ${text.slice(0, 200)}`);
  }

  const { age, error } = (await response.json()) as { age?: number; error?: string };
  if (error) throw new Error(error);
  if (age == null) throw new Error('年齢が取得できませんでした');
  return age;
}
