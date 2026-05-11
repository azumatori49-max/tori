import { useCallback, useEffect, useState } from 'react';
import type { AuthState, StoreKey } from '../types';

const STORAGE_KEY = 'toriyaro-auth';

const load = (): AuthState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeKey: null, isAdmin: false };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { storeKey: null, isAdmin: false };
  }
};

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState>(() => load());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  const loginStore = useCallback((storeKey: StoreKey) => {
    setAuth({ storeKey, isAdmin: false });
  }, []);

  const loginAdmin = useCallback(() => {
    setAuth({ storeKey: '__admin__', isAdmin: true });
  }, []);

  const logout = useCallback(() => {
    setAuth({ storeKey: null, isAdmin: false });
  }, []);

  return { auth, loginStore, loginAdmin, logout };
};
