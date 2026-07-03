/** らくらく店舗メンテナンス カラーパレット（ロゴに合わせたブルー系） */

export const C = {
  /** プライマリ（ロゴブルー） */
  primary: '#1565D8',
  primaryDark: '#0F4CA8',
  primaryLight: '#E3EEFB',
  /** アクセント（チェック・実施済み） */
  accent: '#16A34A',
  /** 警告・要対応 */
  warn: '#D97706',
  danger: '#DC2626',
  /** ベース */
  bg: '#F4F6F9',
  card: '#FFFFFF',
  border: '#E2E8F0',
  /** テキスト */
  text: '#0F172A',
  textSub: '#64748B',
  textFaint: '#94A3B8',
  /** ヘッダー帯 */
  headerBg: '#1565D8',
  headerText: '#FFFFFF',
} as const;

/** 状況ラベル別の色（4段階） */
export const CONDITION_COLOR: Record<string, string> = {
  'とてもよくできてます': '#16A34A',
  'よくできてます': '#0E9488',
  '普通': '#64748B',
  'できてない': '#DC2626',
};
