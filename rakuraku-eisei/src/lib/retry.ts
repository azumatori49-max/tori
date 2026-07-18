/**
 * 通信の瞬断対策: 指数バックオフ付き自動リトライ。
 * パスワード誤り等の「リトライしても無駄なエラー」は即座に投げ直す。
 */

const NO_RETRY_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/too-many-requests',
  'storage/unauthorized',
  'storage/unauthenticated',
]);

const codeOf = (e: unknown): string => (e as { code?: string })?.code ?? '';

export const isPermissionError = (e: unknown): boolean => {
  const code = codeOf(e);
  return code === 'permission-denied' || code === 'storage/unauthorized';
};

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (NO_RETRY_CODES.has(codeOf(e))) throw e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
      }
    }
  }
  throw lastError;
}

/** 処理が一定時間で終わらない場合にエラーにする（ハング防止） */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = '通信'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}がタイムアウトしました。電波の良い場所で再度お試しください。`)), ms)
    ),
  ]);
}
