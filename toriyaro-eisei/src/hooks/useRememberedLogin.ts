const STORAGE_KEY = 'toriyaro-eisei.remembered-login';

interface Remembered {
  storeKey: string;
  password: string;
}

export const readRememberedLogin = (): Remembered | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Remembered>;
    if (typeof parsed.storeKey === 'string' && typeof parsed.password === 'string') {
      return { storeKey: parsed.storeKey, password: parsed.password };
    }
  } catch {
    /* ignore */
  }
  return null;
};

export const writeRememberedLogin = (data: Remembered) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
};

export const clearRememberedLogin = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};
