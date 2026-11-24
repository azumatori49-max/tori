declare const __BUILD_TIME__: string;

/** ビルド日時（vite.config.ts の define で埋め込み）。開発時は 'dev' */
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';
