import { useEffect, useMemo, useState } from 'react';
import {
  buildAndroidIntentUrl,
  detectInAppBrowser,
  detectPlatform,
} from '../../lib/inAppBrowser';

const DISMISS_KEY = 'toriyaro-inapp-dismissed';

export const InAppBrowserGate = () => {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const platform = useMemo(() => detectPlatform(), []);
  const url = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    setShow(detectInAppBrowser());
  }, []);

  if (!show) return null;

  const handleOpen = () => {
    if (platform === 'android') {
      window.location.href = buildAndroidIntentUrl(url);
    } else if (platform === 'ios') {
      window.location.href = url;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="text-5xl mb-4" aria-hidden>
        🌐
      </div>
      <h2 className="text-xl font-black mb-2">標準ブラウザで開いてください</h2>
      <p className="text-sm text-text-muted leading-relaxed max-w-xs mb-6">
        LINE / Instagram などのアプリ内ブラウザではカメラ機能が正しく動作しない場合があります。
        Safari や Chrome など標準のブラウザで開き直してください。
      </p>

      <div className="w-full max-w-xs space-y-2">
        {platform === 'android' && (
          <button
            type="button"
            onClick={handleOpen}
            className="w-full bg-accent text-white font-bold rounded-xl py-3 active:scale-[0.98]"
          >
            Chrome で開く
          </button>
        )}
        {platform === 'ios' && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-accent text-white font-bold rounded-xl py-3 active:scale-[0.98]"
          >
            Safari で開く
          </a>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="w-full bg-surface border border-border font-bold rounded-xl py-3"
        >
          {copied ? 'コピーしました' : 'URLをコピー'}
        </button>
        <p className="text-[11px] text-text-muted break-all bg-surface2 rounded-lg px-3 py-2">
          {url}
        </p>
      </div>

      {platform === 'ios' && (
        <p className="text-[11px] text-text-muted mt-4 max-w-xs leading-relaxed">
          開かない場合は右上の「…」メニューから「Safariで開く」を選択してください。
        </p>
      )}

      <button
        type="button"
        onClick={handleDismiss}
        className="mt-6 text-[11px] text-text-muted underline"
      >
        このまま続ける（推奨しません）
      </button>
    </div>
  );
};
