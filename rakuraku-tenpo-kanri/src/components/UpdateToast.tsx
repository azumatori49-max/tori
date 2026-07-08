import { useEffect, useState } from 'react'

/**
 * 新バージョン通知
 * Service Worker の更新を検知して「新バージョンあり」トーストを表示。
 */
export function UpdateToast() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (reg.waiting) setWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(sw)
          }
        })
      })
    })
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloaded) {
        reloaded = true
        window.location.reload()
      }
    })
  }, [])

  if (!waiting) return null
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-slate-900 p-4 text-white shadow-2xl">
      <p className="text-sm font-semibold">新しいバージョンがあります</p>
      <p className="mt-0.5 text-xs text-slate-300">更新して最新の機能をご利用ください。</p>
      <button
        onClick={() => waiting.postMessage({ type: 'SKIP_WAITING' })}
        className="mt-3 w-full rounded-xl bg-brand-500 py-2 text-sm font-bold hover:bg-brand-400"
      >
        今すぐ更新
      </button>
    </div>
  )
}
