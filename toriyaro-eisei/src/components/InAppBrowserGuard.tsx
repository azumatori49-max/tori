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

  const handleOpenDefault = useCallback(() => {
    const url = window.location.href;
    if (isAndroid()) {
      const stripped = url.replace(/^https?:\/\//, '');
      // No package= → routes to the user's default browser handler.
      const intentUrl = `intent://${stripped}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
      window.location.href = intentUrl;
    } else if (isIOS()) {
      // iOS provides no public API to open the system-default browser
      // from inside another app's webview. Best effort: try Chrome's
      // URL scheme; if Chrome isn't installed, the user falls back to
      // the manual instructions below.
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-warn-bg text-warn mb-3">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
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

        {isAndroid() ? (
          <button type="button" onClick={handleOpenDefault} className="btn-primary w-full mb-3">
            規定ブラウザで開く
          </button>
        ) : null}
        {isIOS() ? (
          <button type="button" onClick={handleOpenDefault} className="btn-primary w-full mb-3">
            Google で開く<span className="text-[11px] font-normal opacity-80 ml-1">（Google アプリ利用時）</span>
          </button>
        ) : null}

        <button type="button" onClick={handleCopy} className="btn-ghost w-full mb-5">
          {copied ? 'URLをコピーしました' : 'URLをコピーして Safari / Google で開く'}
        </button>

        <div className="border-t border-border pt-4 text-xs text-text-muted leading-relaxed">
          <p className="font-bold text-text mb-2">手動で開く方法</p>
          {browser === 'LINE' ? (
            <>
              {isIOS() ? (
                <ol className="space-y-1 list-decimal pl-5">
                  <li>画面右下の共有アイコンをタップ</li>
                  <li>「<strong>Safari で開く</strong>」を選択</li>
                </ol>
              ) : (
                <ol className="space-y-1 list-decimal pl-5">
                  <li>画面右下のメニューアイコンをタップ</li>
                  <li>「他のブラウザで開く」を選択</li>
                  <li>Chrome / Samsung Internet など好きなブラウザを選ぶ</li>
                </ol>
              )}
            </>
          ) : (
            <ol className="space-y-1 list-decimal pl-5">
              <li>画面右上のメニューをタップ</li>
              <li>{isIOS() ? '「Safari で開く」' : '「ブラウザで開く」'}を選択</li>
            </ol>
          )}
          <p className="text-[10px] mt-3 leading-relaxed">
            Safari / Google (Chrome) / Edge / Firefox / Samsung Internet など、標準ブラウザならすべて動作します。LINE / Instagram などアプリ内ブラウザだけが非対応です。
          </p>
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
