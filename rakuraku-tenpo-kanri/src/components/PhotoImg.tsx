import { useEffect, useState } from 'react'
import { idbGet } from '@/lib/idb'

/**
 * 写真表示コンポーネント
 * デモモードの `idb:` URL は IndexedDB から取り出して ObjectURL に変換する。
 */
export function PhotoImg({
  url,
  alt,
  className = '',
  onClick,
}: {
  url: string
  alt: string
  className?: string
  onClick?: () => void
}) {
  const [src, setSrc] = useState<string | null>(url.startsWith('idb:') ? null : url)

  useEffect(() => {
    if (!url.startsWith('idb:')) {
      setSrc(url)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    idbGet(url.slice(4)).then((blob) => {
      if (blob && !cancelled) {
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      }
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  if (!src) {
    return <div className={`animate-pulse bg-slate-200 ${className}`} aria-label={alt} />
  }
  return <img src={src} alt={alt} className={className} onClick={onClick} loading="lazy" />
}
