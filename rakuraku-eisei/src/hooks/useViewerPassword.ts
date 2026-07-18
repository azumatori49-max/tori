import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { withRetry } from '../lib/retry';

/**
 * 閲覧専用ページ（/view）のパスワード（settings/viewer）。
 * 読み取り・変更ともにセキュリティルールで管理者のみに制限されている。
 */
export const useViewerPassword = () => {
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'viewer'),
      (snap) => {
        setPassword(snap.exists() ? ((snap.data() as { password?: string }).password ?? null) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const savePassword = useCallback(async (next: string) => {
    await withRetry(() => setDoc(doc(db, 'settings', 'viewer'), { password: next }));
  }, []);

  return { password, loading, savePassword };
};
