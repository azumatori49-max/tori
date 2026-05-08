import { useState, type FC } from 'react';

const IN_APP_PATTERNS =
  /(Line\/|Instagram|FBAN|FBAV|FB_IAB|FB4A|Twitter|TikTok|MicroMessenger|Snapchat|Pinterest|Slack|KAKAOTALK|NAVER|MoyaBrowse)/i;

const isiOS = (): boolean => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = (): boolean => /Android/i.test(navigator.userAgent);

const isInAppBrowser = (): boolean => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return IN_APP_PATTERNS.test(ua);
};

const openInExternal = () => {
  const href = window.location.href;
  if (isiOS()) {
    // x-safari-https は iOS Safari にハンドオフされる
    window.location.href = `x-safari-${href}`;
    return;
  }
  if (isAndroid()) {
    const noScheme = href.replace(/^https?:\/\//, '');
    window.location.href = `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }
  alert('右上の「⋯」から「ブラウザで開く」を選択してください');
};

export const InAppBrowserGate: FC = () => {
  const [show, setShow] = useState(() => isInAppBrowser());
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-bg p-6 text-center">
      <img
        src="/logo.png"
        alt=""
        className="h-20 w-20 rounded-full object-cover shadow"
      />
      <h2 className="mt-4 text-base font-black">標準ブラウザで開いてください</h2>
      <p className="mt-2 max-w-xs text-xs leading-relaxed text-text-muted">
        このアプリ内ブラウザでは、写真の撮影・送信が正しく動作しないことがあります。
        Safari / Chrome などの標準ブラウザで開き直してください。
      </p>

      <button
        type="button"
        onClick={openInExternal}
        className="mt-6 w-full max-w-xs rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
      >
        標準ブラウザで開く
      </button>

      <details className="mt-4 max-w-xs text-left">
        <summary className="text-xs font-bold text-text-muted">うまく開けない場合</summary>
        <ul className="mt-2 list-inside list-decimal space-y-1 text-[11px] text-text-muted">
          <li>右上の「⋯」または「︙」メニューを開く</li>
          <li>「ブラウザで開く」「Safari で開く」などを選択</li>
          <li>もしくは URL をコピーして Safari / Chrome に貼り付け</li>
        </ul>
      </details>

      <button
        type="button"
        onClick={() => setShow(false)}
        className="mt-6 text-[11px] text-text-muted underline"
      >
        このまま続ける（非推奨）
      </button>
    </div>
  );
};
