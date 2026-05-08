import { useCallback, useEffect, useState } from 'react';
import type { AuthState, StoreKey } from '../types';

const STORAGE_KEY = 'toriyaro-auth';
const SAVED_KEY = 'toriyaro-saved-cred';

export interface SavedCredentials {
  storeKey: string;
  password: string;
}

const loadInitial = (): AuthState => {
  if (typeof window === 'undefined') return { storeKey: null, isAdmin: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeKey: null, isAdmin: false };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { storeKey: null, isAdmin: false };
  }
};

const loadSaved = (): SavedCredentials | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedCredentials;
  } catch {
    return null;
  }
};

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState>(loadInitial);
  const [saved, setSaved] = useState<SavedCredentials | null>(loadSaved);

  useEffect(() => {
    if (auth.storeKey) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [auth]);

  const persistSaved = useCallback((cred: SavedCredentials | null) => {
    setSaved(cred);
    if (cred) {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(cred));
    } else {
      window.localStorage.removeItem(SAVED_KEY);
    }
  }, []);

  const loginAsStore = useCallback(
    (storeKey: StoreKey, password: string, remember = true) => {
      setAuth({ storeKey, isAdmin: false });
      if (remember) persistSaved({ storeKey, password });
    },
    [persistSaved],
  );

  const loginAsAdmin = useCallback(
    (password: string, remember = true) => {
      setAuth({ storeKey: '__admin__', isAdmin: true });
      if (remember) persistSaved({ storeKey: '__admin__', password });
    },
    [persistSaved],
  );

  const logout = useCallback(() => {
    setAuth({ storeKey: null, isAdmin: false });
  }, []);

  const forgetSavedCredentials = useCallback(() => {
    persistSaved(null);
  }, [persistSaved]);

  return {
    auth,
    saved,
    loginAsStore,
    loginAsAdmin,
    logout,
    forgetSavedCredentials,
  };
};
