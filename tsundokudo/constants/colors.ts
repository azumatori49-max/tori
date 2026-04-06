/** 木目調本棚 & アプリ全体のカラーパレット */

export const WOOD = {
  /** 棚板の最暗部（影・縁） */
  darkest: '#1A0A00',
  /** 棚板の下辺（前面エッジ） */
  ledge: '#2E1205',
  /** 棚板メイン */
  dark: '#4A2008',
  /** 棚板中間（横木目ライン） */
  grain: '#5C2E10',
  /** 棚板表面 */
  medium: '#7A4020',
  /** 棚板ハイライト（上辺の光） */
  highlight: '#9E5830',
  /** 背景（棚の壁面） */
  bg: '#3A1A06',
} as const;

/** ステータス別カラー */
export const STATUS_COLOR: Record<string, string> = {
  unread: '#64748B',
  reading: '#2563EB',
  completed: '#16A34A',
  paused: '#D97706',
};

/** ステータス別背景色（淡め） */
export const STATUS_BG: Record<string, string> = {
  unread: '#EFF2F5',
  reading: '#EFF6FF',
  completed: '#F0FDF4',
  paused: '#FFFBEB',
};

/** ステータス日本語ラベル */
export const STATUS_LABEL: Record<string, string> = {
  all: 'すべて',
  unread: '未読',
  reading: '読書中',
  completed: '読了',
  paused: '中断',
};

/** 背表紙フォールバックカラー（cover_urlがない場合） */
export const SPINE_FALLBACK_COLORS = [
  '#C2410C', // orange-700
  '#1D4ED8', // blue-700
  '#15803D', // green-700
  '#7C3AED', // violet-600
  '#B91C1C', // red-700
  '#0E7490', // cyan-700
  '#A16207', // yellow-700
  '#9D174D', // pink-800
  '#1E3A5F', // navy
  '#3B5323', // dark olive
] as const;
