/**
 * アプリ全体のフォント（Noto Sans JP）。
 *
 * - Web: global.css で Google Fonts の Noto Sans JP を読み込んで適用
 * - PDF: lib/reportHtml.ts で同フォントを読み込み
 * - ネイティブ: Noto Sans JP は端末標準ではないため、
 *   フォントファイルを同梱しない限り端末標準にフォールバックする
 *   （Android は標準が Noto Sans CJK、iOS はヒラギノ）
 *
 * ネイティブ側のスタイルでは fontFamily を指定せず端末標準に任せる。
 */
export const FONT_FAMILY: string | undefined = undefined;
