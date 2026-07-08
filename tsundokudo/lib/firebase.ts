/**
 * Firebase クライアント（Google Cloud）。
 *
 * 環境変数 EXPO_PUBLIC_FIREBASE_CONFIG が設定されている場合のみ有効化される。
 * 未設定時は null（端末ローカル保存のまま動作）。
 *
 * EXPO_PUBLIC_FIREBASE_CONFIG には Firebase コンソールの
 * 「アプリを追加 > ウェブ」で表示される firebaseConfig を
 * そのまま貼り付ければよい（JS形式でもJSONでも解釈できる）。
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

const RAW_CONFIG = String(process.env.EXPO_PUBLIC_FIREBASE_CONFIG ?? '');

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
  messagingSenderId?: string;
}

/**
 * 貼り付けられた設定文字列から必要なキーを取り出す。
 * コンソールのJSスニペット（キーが引用符なし）でも厳密なJSONでも動くよう
 * 正規表現で抜き出す。
 */
function parseConfig(raw: string): FirebaseConfig | null {
  if (!raw.trim()) return null;
  const pick = (key: string): string => {
    const m = raw.match(new RegExp(`${key}\\s*["']?\\s*[:=]\\s*["']([^"']+)["']`));
    return m?.[1] ?? '';
  };
  const config: FirebaseConfig = {
    apiKey: pick('apiKey'),
    authDomain: pick('authDomain'),
    projectId: pick('projectId'),
    storageBucket: pick('storageBucket'),
    appId: pick('appId'),
    messagingSenderId: pick('messagingSenderId') || undefined,
  };
  if (!config.apiKey || !config.projectId || !config.appId) return null;
  if (!config.authDomain) config.authDomain = `${config.projectId}.firebaseapp.com`;
  if (!config.storageBucket) config.storageBucket = `${config.projectId}.firebasestorage.app`;
  return config;
}

const config = parseConfig(RAW_CONFIG);

/** クラウド（共有＋ログイン）が有効かどうか */
export const isCloudEnabled = config != null;

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

if (config) {
  app = initializeApp(config);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);

  // テスト用: ローカルエミュレータへ接続（本番ビルドでは未設定）
  if (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR) {
    connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(dbInstance, 'localhost', 8080);
    connectStorageEmulator(storageInstance, 'localhost', 9199);
  }
}

export const fbAuth = authInstance;
export const fbDb = dbInstance;
export const fbStorage = storageInstance;
