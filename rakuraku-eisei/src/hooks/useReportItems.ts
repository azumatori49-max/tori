import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { withRetry } from '../lib/retry';
import type { ReportType } from '../types';

export const SLOT_COUNT = 7;

export interface ReportItems {
  daily: string[];
  weekly: string[];
}

/** 初期値（管理者画面からいつでも変更可能） */
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

const pad = (arr: unknown, fallback: string[]): string[] =>
  Array.from({ length: SLOT_COUNT }, (_, i) => {
    const v = Array.isArray(arr) ? arr[i] : undefined;
    return typeof v === 'string' ? v : (fallback[i] ?? '');
  });

/**
 * 撮影項目の名称マスタ（settings/reportItems）。
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
            daily: pad(d.daily, DEFAULT_ITEMS.daily),
            weekly: pad(d.weekly, DEFAULT_ITEMS.weekly),
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
        daily: pad(next.daily, DEFAULT_ITEMS.daily),
        weekly: pad(next.weekly, DEFAULT_ITEMS.weekly),
      })
    );
  }, []);

  return { items, loading, saveItems };
};

export const getItemLabels = (items: ReportItems, type: ReportType): string[] =>
  type === 'daily' ? items.daily : items.weekly;
