import { useCallback, useEffect, useState } from 'react';

const detectInApp = (): string | null => {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/\bLine\//i.test(ua)) return 'LINE';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV/i.test(ua)) return 'Facebook';
  if (/\bTwitter/i.test(ua)) return 'Twitter / X';
  if (/TikTok/i.test(ua)) return 'TikTok';
  if (/KAKAOTALK/i.test(ua)) return 'KakaoTalk';
  return null;
};

const isAndroid = () =>
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
const isIOS = () =>
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

interface Props {
  /**
   * If false (default), keep showing the guard while the user is in an
   * in-app browser. If the user explicitly chose '続行', allow access.
   */
  allowBypass?: boolean;
}

const BYPASS_KEY = 'toriyaro-eisei.allow-inapp';

export const InAppBrowserGuard = ({ allowBypass = true }: Props) => {
  const [browser, setBrowser] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bypassed, setBypassed] = useState(false);

  useEffect(() => {
    if (allowBypass && sessionStorage.getItem(BYPASS_KEY) === '1') {
      setBypassed(true);
      return;
    }
    const detected = detectInApp();
    if (detected) {
      setBrowser(detected);
      // Try LINE's documented escape param: appending ?openExternalBrowser=1
      // makes LINE open the URL in the system browser when re-opened.
      if (detected === 'LINE') {
        const url = new URL(window.location.href);
        if (url.searchParams.get('openExternalBrowser') !== '1') {
          url.searchParams.set('openExternalBrowser', '1');
          // Replace history so reload uses the augmented URL.
          window.history.replaceState(null, '', url.toString());
        }
      }
    }
  }, [allowBypass]);

  const handleOpenChrome = useCallback(() => {
    const url = window.location.href;
    if (isAndroid()) {
      const stripped = url.replace(/^https?:\/\//, '');
      // Android intent — works from most in-app browsers including LINE.
      const intentUrl = `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = intentUrl;
    } else if (isIOS()) {
      // iOS Chrome scheme.
      const stripped = url.replace(/^https?:\/\//, '');
      window.location.href = `googlechrome://${stripped}`;
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const url = window.location.href.split('?')[0];
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, []);

  const handleBypass = useCallback(() => {
    sessionStorage.setItem(BYPASS_KEY, '1');
    setBypassed(true);
  }, []);

  if (!browser || bypassed) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex items-center justify-center p-4 overflow-y-auto">
      <div className="card max-w-sm w-full p-6 shadow-xl my-auto">
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">⚠️</div>
          <h2 className="font-display text-xl font-extrabold mb-2 leading-tight">
            標準ブラウザで開いてください
          </h2>
          <p className="text-sm text-text-muted leading-relaxed">
            <strong className="text-text">{browser}</strong>{' '}
            のアプリ内ブラウザでは、
            <br />
            カメラ起動や写真提出が正しく動きません。
          </p>
        </div>

        {(isAndroid() || isIOS()) && (
          <button type="button" onClick={handleOpenChrome} className="btn-primary w-full mb-3">
            {isAndroid() ? '🚀 Chrome で開く' : '🚀 Chrome で開く（要インストール）'}
          </button>
        )}

        <button type="button" onClick={handleCopy} className="btn-ghost w-full mb-5">
          {copied ? '✓ URLをコピーしました' : '📋 URLをコピーして手動で開く'}
        </button>

        <div className="border-t border-border pt-4 text-xs text-text-muted leading-relaxed">
          <p className="font-bold text-text mb-2">手動で開く方法</p>
          {browser === 'LINE' ? (
            <ol className="space-y-1 list-decimal pl-5">
              <li>画面右下の「︙」または「…」アイコンをタップ</li>
              <li>「他のブラウザで開く」を選択</li>
              <li>Chrome / Safari を選んで開く</li>
            </ol>
          ) : (
            <ol className="space-y-1 list-decimal pl-5">
              <li>画面右上の「⋯」メニューをタップ</li>
              <li>「ブラウザで開く」または「Safariで開く」を選択</li>
            </ol>
          )}
        </div>

        <p className="text-[10px] text-text-muted text-center mt-4 leading-relaxed">
          ホーム画面に追加すると次回から自動で標準ブラウザで開きます。
        </p>

        {allowBypass ? (
          <button
            type="button"
            onClick={handleBypass}
            className="text-[11px] text-text-muted underline mt-4 mx-auto block"
          >
            このまま続ける（推奨しません）
          </button>
        ) : null}
      </div>
    </div>
  );
};
