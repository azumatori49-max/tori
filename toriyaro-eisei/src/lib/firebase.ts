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
  apiKey: 'AIzaSyAb88OQsOQupIatDR8TlDPeTACymyPYKRQ',
  authDomain: 'toriyaro-eisei-faf2e.firebaseapp.com',
  databaseURL: 'https://toriyaro-eisei-faf2e-default-rtdb.firebaseio.com',
  projectId: 'toriyaro-eisei-faf2e',
  storageBucket: 'toriyaro-eisei-faf2e.firebasestorage.app',
  messagingSenderId: '120041502005',
  appId: '1:120041502005:web:a9000f1dbfcfc4047bc87c',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
export const storage = getStorage(firebaseApp);
export const firebaseAuth = getAuth(firebaseApp);

export const ADMIN_PASSWORD = 'admin2024';

const ANON_TIMEOUT_MS = 12_000;

/**
 * 起動時に匿名認証を確立する。RTDB / Storage のルールが
 * `auth != null` を要求するため、これが完了する前にデータ読み書きを試みると失敗する。
 *
 * Firebase Console で「Authentication → Sign-in method → 匿名」が有効化されている必要がある。
 */
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
