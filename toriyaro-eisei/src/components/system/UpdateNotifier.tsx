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

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-accent px-3 py-2 text-xs font-bold text-white shadow-lg">
      新しいバージョンがあります
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full bg-white px-3 py-1 text-accent"
      >
        更新
      </button>
    </div>
  );
};