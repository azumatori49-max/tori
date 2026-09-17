import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthState, StoreKey } from '../types';

const STORAGE_KEY = 'toriyaro-eisei.auth';

// === ここを変更すれば日数を調整できます ===
const STORE_IDLE_DAYS = 30;
const ADMIN_IDLE_DAYS = 7;
// =========================================

const DAY_MS = 24 * 60 * 60 * 1000;
const TOUCH_THROTTLE_MS = 60_000; // localStorageへの書き込みは最大1分に1回

interface StoredAuth {
  storeKey: StoreKey | '__admin__' | null;
  isAdmin: boolean;
  lastActivity?: number;
}

const idleLimitMs = (isAdmin: boolean) =>
  (isAdmin ? ADMIN_IDLE_DAYS : STORE_IDLE_DAYS) * DAY_MS;

const readStoredAuth = (): { auth: AuthState; lastActivity: number } => {
  const empty = { auth: { storeKey: null, isAdmin: false }, lastActivity: 0 };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed.storeKey) return empty;
    const now = Date.now();
    const last = parsed.lastActivity ?? now;
    if (now - last > idleLimitMs(!!parsed.isAdmin)) {
      // 期限切れ → 破棄
      window.localStorage.removeItem(STORAGE_KEY);
      return empty;
    }
    return {
      auth: { storeKey: parsed.storeKey, isAdmin: !!parsed.isAdmin },
      lastActivity: last,
    };
  } catch {
    return empty;
  }
};

const writeStoredAuth = (auth: AuthState, lastActivity: number) => {
  if (typeof window === 'undefined') return;
  if (!auth.storeKey) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const payload: StoredAuth = {
    storeKey: auth.storeKey,
    isAdmin: auth.isAdmin,
    lastActivity,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota などは無視
  }
};

export const useAuth = () => {
  const initial = useMemo(() => readStoredAuth(), []);
  const [auth, setAuth] = useState<AuthState>(initial.auth);
  const lastActivityRef = useRef<number>(initial.lastActivity || Date.now());
  const lastWriteRef = useRef<number>(initial.lastActivity || 0);

  // ログイン/ログアウト時に localStorage を同期
  useEffect(() => {
    if (auth.storeKey) {
      const now = Date.now();
      lastActivityRef.current = now;
      lastWriteRef.current = now;
      writeStoredAuth(auth, now);
    } else {
      writeStoredAuth(auth, 0);
    }
  }, [auth]);

  // 操作のたびに最終操作時刻を更新（書き込みはスロットル）
  useEffect(() => {
    if (!auth.storeKey) return;

    const touch = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastWriteRef.current > TOUCH_THROTTLE_MS) {
        lastWriteRef.current = now;
        writeStoredAuth(auth, now);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastActivityRef.current > idleLimitMs(auth.isAdmin)) {
        setAuth({ storeKey: null, isAdmin: false });
        return;
      }
      touch();
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'focus'];
    for (const e of events) {
      window.addEventListener(e, touch, { passive: true } as AddEventListenerOptions);
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      for (const e of events) {
        window.removeEventListener(e, touch);
      }
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [auth]);

  const loginAsStore = useCallback((storeKey: StoreKey) => {
    setAuth({ storeKey, isAdmin: false });
  }, []);

  const loginAsAdmin = useCallback(() => {
    setAuth({ storeKey: '__admin__', isAdmin: true });
  }, []);

  const logout = useCallback(() => {
    setAuth({ storeKey: null, isAdmin: false });
  }, []);

  return { auth, loginAsStore, loginAsAdmin, logout };
};
