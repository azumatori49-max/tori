/**
 * 画像圧縮ユーティリティ
 * 長辺 1280px / JPEG 品質 0.72 に圧縮してアップロード容量と時間を削減。
 * 圧縮に失敗した場合は元画像をそのまま使う（フォールバック）。
 */
const MAX_EDGE = 1280
const QUALITY = 0.72

export async function compressImage(file: File | Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    )
    if (!blob) throw new Error('toBlob returned null')
    // 圧縮の結果むしろ大きくなった場合は元画像を使う
    return blob.size < file.size ? blob : file
  } catch {
    return file
  }
}
