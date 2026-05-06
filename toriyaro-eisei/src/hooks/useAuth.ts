import { useCallback, useEffect, useState } from 'react';
import type { AuthState, StoreKey } from '../types';

const STORAGE_KEY = 'toriyaro-eisei.auth';

const readStoredAuth = (): AuthState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeKey: null, isAdmin: false };
    const parsed = JSON.parse(raw) as AuthState;
    if (typeof parsed.storeKey === 'string' || parsed.storeKey === null) {
      return {
        storeKey: parsed.storeKey,
        isAdmin: !!parsed.isAdmin,
      };
    }
  } catch {
    /* ignore */
  }
  return { storeKey: null, isAdmin: false };
};

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState>(() => readStoredAuth());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } catch {
      /* ignore */
    }
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
