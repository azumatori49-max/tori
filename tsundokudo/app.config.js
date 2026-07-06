/**
 * Expo 設定（app.json の代わりに動的設定を使用）
 *
 * WEB_BASE_URL:
 *   Webビルドの配信パス。GitHub Pages（/tori 配下）が既定。
 *   Cloudflare Pages / Netlify / Vercel などルート配信のホスティングでは
 *   環境変数 WEB_BASE_URL="" を指定してビルドする。
 */
const baseUrl = process.env.WEB_BASE_URL ?? '/tori';

export default {
  expo: {
    name: 'らくらく店舗メンテナンス',
    slug: 'eisei-report',
    scheme: 'eisei',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
      output: 'single',
    },
    experiments: baseUrl ? { baseUrl } : {},
    plugins: [
      [
        'expo-image-picker',
        {
          photosPermission:
            '店舗・作業の写真をレポートに添付するためにアクセスを許可してください。',
          cameraPermission:
            '店舗・作業の写真を撮影するためにカメラの使用を許可してください。',
        },
      ],
    ],
  },
};
