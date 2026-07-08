/**
 * 通信の瞬断対策: 指数バックオフ付き自動リトライ（最大3回）
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i))
      }
    }
  }
  throw lastError
}
