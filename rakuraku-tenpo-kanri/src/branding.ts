/**
 * ブランド設定（ホワイトラベル対応）
 * 販売先ごとにここを書き換えるだけでアプリ名・キャッチコピーを変更できます。
 */
export const BRAND = {
  appName: 'らくらく店舗カンリ',
  tagline: '写真を撮って送るだけ。店舗チェックをかんたんに。',
  company: '',
  /** デイリー履歴のさかのぼり日数 */
  dailyHistoryDays: 14,
  /** ウィークリー履歴のさかのぼり週数 */
  weeklyHistoryWeeks: 8,
  /** 業務日の切り替え時刻（この時刻より前は前日扱い） */
  businessDayCutoverHour: 9,
  /** 未使用時の自動ログアウト日数 */
  autoLogoutDays: 30,
  /** 古いデータの自動整理日数 */
  dataRetentionDays: 90,
  /** 複数枚アップロード可能な項目の最大枚数 */
  multiPhotoMax: 20,
} as const
