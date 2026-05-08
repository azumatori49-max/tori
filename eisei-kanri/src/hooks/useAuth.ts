import { useCallback, useEffect, useState } from 'react';
import type { AuthState, StoreKey } from '../types';

const STORAGE_KEY = 'toriyaro-auth';

const loadInitial = (): AuthState => {
  if (typeof window === 'undefined') return { storeKey: null, isAdmin: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeKey: null, isAdmin: false };
    const parsed = JSON.parse(raw) as AuthState;
    return parsed;
  } catch {
    return { storeKey: null, isAdmin: false };
  }
};

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState>(loadInitial);

  useEffect(() => {
    if (auth.storeKey) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
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
