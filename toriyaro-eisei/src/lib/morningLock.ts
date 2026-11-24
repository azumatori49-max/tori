import type { StoreKey } from '../types';

/** AM6:00〜8:59 にデイリーの編集を締め切る店舗（確認のみ可能にする） */
const MORNING_LOCK_STORE_KEYS = new Set<string>([
  'store_e567a64b', // カラオケ池袋店
]);

/** いま、この店舗のデイリーが「確認のみ」の時間帯か */
export const isMorningLocked = (storeKey: StoreKey): boolean => {
  const h = new Date().getHours();
  return MORNING_LOCK_STORE_KEYS.has(storeKey) && h >= 6 && h < 9;
};
