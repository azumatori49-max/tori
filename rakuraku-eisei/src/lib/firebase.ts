import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { FIREBASE_CONFIG } from '../config';

export const app = initializeApp(FIREBASE_CONFIG);

/**
 * Firestore は通信安定化のため
 *  - オフラインキャッシュ（persistentLocalCache）: 電波が不安定でも表示が保てる
 *  - 自動ロングポーリング検知: WebSocket が塞がれた店舗Wi-Fi等でも接続できる
 * を有効にして初期化する。
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
  experimentalAutoDetectLongPolling: true,
});

export const auth = getAuth(app);
export const storage = getStorage(app);
