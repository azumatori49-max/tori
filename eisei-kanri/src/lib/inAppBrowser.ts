const IN_APP_PATTERNS = [
  /Line\//i,
  /Instagram/i,
  /FBAN/i,
  /FBAV/i,
  /FB_IAB/i,
  /Twitter/i,
  /TikTok/i,
  /MicroMessenger/i,
  /KAKAOTALK/i,
];

export const detectInAppBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return IN_APP_PATTERNS.some((re) => re.test(ua));
};

export const detectPlatform = (): 'ios' | 'android' | 'other' => {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
};

export const buildAndroidIntentUrl = (url: string): string => {
  try {
    const u = new URL(url);
    const host = u.host;
    const pathQuery = `${u.pathname}${u.search}${u.hash}`;
    return `intent://${host}${pathQuery}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`;
  } catch {
    return url;
  }
};
