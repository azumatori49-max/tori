/** スマートフォン・タブレットかどうかの判定（iPadのPC表示モードにも対応） */
export const isMobileDevice = (): boolean =>
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);