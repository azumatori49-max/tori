import { useEffect, useState, type FC } from 'react';

const extractBundles = (html: string): string =>
  Array.from(html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g))
    .map((m) => m[1])
    .sort()
    .join('|');

const getCurrentBundles = (): string =>
  Array.from(document.querySelectorAll('script[src]'))
    .map((s) => new URL((s as HTMLScriptElement).src).pathname)
    .sort()
    .join('|');

/** お知らせの帯の高さ(px)。「更新」ボタンを44px確保する */
const BANNER_HEIGHT = 56;

export const UpdateNotifier: FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const current = getCurrentBundles();

    const check = async () => {
      try {
        const res = await fetch('/index.html?ts=' + Date.now(), { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const html = await res.text();
        const live = extractBundles(html);
        if (live && live !== current) {
          setUpdateAvailable(true);
        }
      } catch {}
    };

    check();
    const id = window.setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // お知らせを出している間は、その高さぶんヘッダー・本文・「ご意見」ボタンを下にずらす
  // （styles.css の --update-banner-h を参照。ヘッダーのボタンを覆わないため）
  useEffect(() => {
    const root = document.documentElement;
    if (updateAvailable) root.style.setProperty('--update-banner-h', `${BANNER_HEIGHT}px`);
    else root.style.removeProperty('--update-banner-h');
    return () => {
      root.style.removeProperty('--update-banner-h');
    };
  }, [updateAvailable]);

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-3 bg-accent px-3 text-sm font-bold text-white shadow-lg"
      style={{ height: BANNER_HEIGHT }}
      role="status"
    >
      新しいバージョンがあります
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-accent"
      >
        更新
      </button>
    </div>
  );
};