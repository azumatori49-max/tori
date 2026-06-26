/** 衛生管理アプリ カラーパレット（クリーン／清潔感のあるブルーグリーン系） */

export const C = {
  /** プライマリ（清潔感のあるティール） */
  primary: '#0E9488',
  primaryDark: '#0B7268',
  primaryLight: '#D6F2EE',
  /** アクセント（チェック・実施済み） */
  accent: '#16A34A',
  /** 警告・要対応 */
  warn: '#D97706',
  danger: '#DC2626',
  /** ベース */
  bg: '#F4F7F8',
  card: '#FFFFFF',
  border: '#E2E8F0',
  /** テキスト */
  text: '#0F172A',
  textSub: '#64748B',
  textFaint: '#94A3B8',
  /** ヘッダー帯 */
  headerBg: '#0E9488',
  headerText: '#FFFFFF',
} as const;

/** 状況ラベル別の色 */
export const CONDITION_COLOR: Record<string, string> = {
  'とても良く出来ています': '#16A34A',
  '良く出来ています': '#0E9488',
  '普通です': '#64748B',
  '改善が必要です': '#D97706',
  '要対応': '#DC2626',
};
