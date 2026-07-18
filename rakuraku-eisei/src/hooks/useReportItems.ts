import { deleteField, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { withRetry } from '../lib/retry';
import type { ReportItems, ReportType, Store, StoreKey } from '../types';

export const SLOT_COUNT = 7;

export type { ReportItems };

/** 共通設定の初期値（管理者画面からいつでも変更可能） */
export const DEFAULT_ITEMS: ReportItems = {
  daily: [
    'コーラサーバー洗浄',
    'ビールサーバー洗浄',
    'グリスト',
    'フードレンジ',
    'フライヤー',
    '洗剤補充',
    '衛生管理報告',
  ],
  weekly: [
    'コーラサーバー洗浄',
    'ビールサーバー洗浄',
    'グリスト',
    'フードレンジ',
    'フライヤー',
    '洗剤補充',
    '衛生管理報告',
  ],
};

/** 7枠に整形（欠けはfallback→空文字で補完） */
export const padLabels = (arr: unknown, fallback: string[]): string[] =>
  Array.from({ length: SLOT_COUNT }, (_, i) => {
    const v = Array.isArray(arr) ? arr[i] : undefined;
    return typeof v === 'string' && v !== '' ? v : (fallback[i] ?? '');
  });

/**
 * 撮影項目の共通設定（settings/reportItems）。
 * 読み取りは全員可・変更はセキュリティルールにより管理者のみ。
 */
export const useReportItems = () => {
  const [items, setItems] = useState<ReportItems>(DEFAULT_ITEMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'reportItems'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as Partial<ReportItems>;
          setItems({
            daily: padLabels(d.daily, DEFAULT_ITEMS.daily),
            weekly: padLabels(d.weekly, DEFAULT_ITEMS.weekly),
          });
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const saveItems = useCallback(async (next: ReportItems) => {
    await withRetry(() =>
      setDoc(doc(db, 'settings', 'reportItems'), {
        daily: padLabels(next.daily, DEFAULT_ITEMS.daily),
        weekly: padLabels(next.weekly, DEFAULT_ITEMS.weekly),
      })
    );
  }, []);

  return { items, loading, saveItems };
};

/** 店舗ごとの上書き設定を保存（stores/{key}.items）。管理者のみ */
export const saveStoreItems = async (
  storeKey: StoreKey,
  next: ReportItems
): Promise<void> => {
  await withRetry(() =>
    setDoc(
      doc(db, 'stores', storeKey),
      { items: { daily: next.daily, weekly: next.weekly } },
      { merge: true }
    )
  );
};

/** 店舗ごとの上書きを解除して共通設定に戻す。管理者のみ */
export const clearStoreItems = async (storeKey: StoreKey): Promise<void> => {
  await withRetry(() => updateDoc(doc(db, 'stores', storeKey), { items: deleteField() }));
};

/**
 * 表示用ラベルの解決:
 * 店舗の個別設定があればそれを優先し、無い枠は共通設定で補完する。
 */
export const resolveLabels = (
  common: ReportItems,
  store: Store | undefined,
  type: ReportType
): string[] => {
  const base = type === 'daily' ? common.daily : common.weekly;
  const override = store?.items?.[type];
  return padLabels(override, base);
};

export const getItemLabels = (items: ReportItems, type: ReportType): string[] =>
  type === 'daily' ? items.daily : items.weekly;
