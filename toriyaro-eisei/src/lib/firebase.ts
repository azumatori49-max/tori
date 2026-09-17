import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyD1xffqVr8Eir6IxJKF2PkgdCfYL2VUcQ8',
  authDomain: 'toriyaro-eisei-v2.firebaseapp.com',
  databaseURL: 'https://toriyaro-eisei-v2-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'toriyaro-eisei-v2',
  storageBucket: 'toriyaro-eisei-v2.firebasestorage.app',
  messagingSenderId: '135163583805',
  appId: '1:135163583805:web:05d3bb3d553aeea452b954',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
export const storage = getStorage(firebaseApp);
export const firebaseAuth = getAuth(firebaseApp);

export const ADMIN_PASSWORD = 'toriyaro2026';

const ANON_TIMEOUT_MS = 12_000;

export const ensureAnonymousAuth = (): Promise<User> => {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error('匿名認証の応答がタイムアウトしました。Firebase Console の Authentication → Sign-in method で「匿名」を有効化してください。')));
    }, ANON_TIMEOUT_MS);

    const unsub = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        if (user) {
          window.clearTimeout(timer);
          unsub();
          finish(() => resolve(user));
          return;
        }
        signInAnonymously(firebaseAuth).catch((err) => {
          window.clearTimeout(timer);
          unsub();
          finish(() => reject(err));
        });
      },
      (err) => {
        window.clearTimeout(timer);
        unsub();
        finish(() => reject(err));
      },
    );
  });
};
