import { useCallback, useState } from "react";
import type { AuthState, StoreKey } from "../types";

const STORAGE_KEY = "toriyaro-eisei-auth";

const load = (): AuthState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeKey: null, isAdmin: false };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { storeKey: null, isAdmin: false };
  }
};

const save = (s: AuthState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

export const useAuth = () => {
  const [auth, setAuth] = useState<AuthState>(load);

  const loginStore = useCallback((storeKey: StoreKey) => {
    const next: AuthState = { storeKey, isAdmin: false };
    setAuth(next);
    save(next);
  }, []);

  const loginAdmin = useCallback(() => {
    const next: AuthState = { storeKey: "__admin__", isAdmin: true };
    setAuth(next);
    save(next);
  }, []);

  const logout = useCallback(() => {
    const next: AuthState = { storeKey: null, isAdmin: false };
    setAuth(next);
    save(next);
  }, []);

  return { auth, loginStore, loginAdmin, logout };
};
