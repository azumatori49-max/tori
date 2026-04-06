import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── 背表紙 (Spine) ──────────────────────────────────────────
/** aspectRatio 0.25 = width / height */
export const SPINE_ASPECT_RATIO = 0.25;
/** 背表紙の高さ（本の高さ） */
export const SPINE_HEIGHT = 152;
/** 背表紙の幅 = 152 × 0.25 = 38px */
export const SPINE_WIDTH = Math.round(SPINE_HEIGHT * SPINE_ASPECT_RATIO);
/** 背表紙間の隙間 */
export const SPINE_GAP = 3;
/** 棚の左右パディング */
export const SHELF_PADDING_H = 12;
/** 棚板（ledge）の高さ */
export const SHELF_LEDGE_H = 18;
/** 棚板上部の影領域 */
export const SHELF_SHADOW_H = 6;
/** 1行あたり最大表示冊数 */
export const BOOKS_PER_ROW = Math.floor(
  (SCREEN_WIDTH - SHELF_PADDING_H * 2) / (SPINE_WIDTH + SPINE_GAP),
);
/** 棚1行の合計高さ（本の高さ + 棚板 + 影） */
export const SHELF_ROW_HEIGHT = SPINE_HEIGHT + SHELF_LEDGE_H + SHELF_SHADOW_H + 8;

// ─── グリッドビュー ──────────────────────────────────────────
export const GRID_COLUMNS = 3;
export const GRID_PADDING_H = 12;
export const GRID_GAP = 10;
export const GRID_ITEM_WIDTH =
  Math.floor((SCREEN_WIDTH - GRID_PADDING_H * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
/** グリッド表紙の高さ（3:4比率） */
export const GRID_ITEM_HEIGHT = Math.round(GRID_ITEM_WIDTH * (4 / 3));

// ─── プレスアニメーション ──────────────────────────────────
/** pressIn 時の浮き上がり量 (px) */
export const PRESS_LIFT_Y = -14;
