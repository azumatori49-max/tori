import type { AppConfig, CheckItem, Store } from '../types'

/** 全店共通のデフォルト項目（管理者画面から変更可能） */
export const DEFAULT_DAILY_ITEMS: CheckItem[] = [
  { id: 'duster', name: 'ダスター', hint: '漂白・洗浄後の状態を撮影' },
  { id: 'cutting-board', name: 'まな板', hint: '洗浄・消毒後の状態を撮影' },
  { id: 'dishwasher', name: '洗浄機', hint: '槽内の清掃後を撮影' },
  { id: 'fridge-temp', name: '冷蔵庫温度', hint: '温度計の表示を撮影' },
  { id: 'handwash', name: '手洗い場', hint: '石けん・ペーパーの補充状態を撮影' },
  { id: 'grease-trap', name: 'グリストラップ', hint: '清掃後の状態を撮影' },
  {
    id: 'security-cam',
    name: '防犯カメラ',
    hint: '録画画面のスクリーンショット等（複数枚可）',
    multi: true,
    maxPhotos: 20,
  },
]

export const DEFAULT_WEEKLY_ITEMS: CheckItem[] = [
  { id: 'ice-machine', name: '製氷機', hint: '庫内清掃後を撮影' },
  { id: 'vent-filter', name: '換気扇フィルター', hint: '洗浄後のフィルターを撮影' },
  { id: 'fridge-clean', name: '冷蔵庫内清掃', hint: '整理・清掃後の庫内を撮影' },
  { id: 'drain', name: '排水溝', hint: '清掃後の状態を撮影' },
  { id: 'wall-floor', name: '壁・床', hint: '厨房の壁・床の清掃後を撮影' },
  { id: 'pest-check', name: '害虫チェック', hint: 'トラップ・侵入経路の確認状況を撮影' },
  { id: 'storage', name: '倉庫整理', hint: '整理整頓後の倉庫を撮影' },
  { id: 'garbage', name: 'ゴミ庫', hint: '清掃後のゴミ置き場を撮影' },
]

export const DEFAULT_CONFIG: AppConfig = {
  adminPassword: 'admin1234',
  defaultItems: {
    daily: DEFAULT_DAILY_ITEMS,
    weekly: DEFAULT_WEEKLY_ITEMS,
  },
}

/** デモモード用のサンプル店舗（実運用では管理者画面から店舗を登録） */
export const DEMO_STORES: Store[] = [
  { id: 'st-001', name: '新宿本店', password: '1111', active: true, createdAt: 0 },
  { id: 'st-002', name: '渋谷店', password: '1111', active: true, createdAt: 0 },
  { id: 'st-003', name: '池袋店', password: '1111', active: true, createdAt: 0 },
  {
    id: 'st-004',
    name: '北千住店',
    password: '1111',
    active: true,
    createdAt: 0,
    excludedItemIds: ['grease-trap'],
  },
  {
    id: 'st-005',
    name: '福島栄町店',
    password: '1111',
    active: true,
    createdAt: 0,
    excludedItemIds: ['grease-trap'],
  },
  {
    id: 'st-006',
    name: 'まる助 上野店',
    password: '1111',
    active: true,
    createdAt: 0,
    customItems: {
      daily: [{ id: 'marusuke-counter', name: 'カウンター清掃', hint: 'まる助系店舗の独自項目' }],
    },
  },
  { id: 'st-007', name: 'まる助 神田店', password: '1111', active: true, createdAt: 0 },
  { id: 'st-008', name: '大宮店', password: '1111', active: true, createdAt: 0 },
]
