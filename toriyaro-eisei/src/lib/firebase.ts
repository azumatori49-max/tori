import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAb88OQsOQupIatDR8TlDPeTACymyPYKRQ',
  authDomain: 'toriyaro-eisei-faf2e.firebaseapp.com',
  databaseURL:
    'https://toriyaro-eisei-faf2e-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'toriyaro-eisei-faf2e',
  storageBucket: 'toriyaro-eisei-faf2e.firebasestorage.app',
  messagingSenderId: '120041502005',
  appId: '1:120041502005:web:a9000f1dbfcfc4047bc87c',
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

const AUTH_TIMEOUT_MS = 8000;

export const authReady: Promise<User> = new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(
      new Error(
        '匿名認証の応答がタイムアウトしました。Firebase Console の Authentication → Sign-in method で「匿名」を有効化してください。',
      ),
    );
  }, AUTH_TIMEOUT_MS);

  const unsubscribe = onAuthStateChanged(
    auth,
    (user) => {
      if (user) {
        clearTimeout(timer);
        unsubscribe();
        resolve(user);
      }
    },
    (err) => {
      clearTimeout(timer);
      unsubscribe();
      reject(err);
    },
  );

  signInAnonymously(auth).catch((err) => {
    clearTimeout(timer);
    unsubscribe();
    reject(err);
  });
});

authReady.catch((err) => {
  console.error('anonymous sign-in failed:', err);
});
