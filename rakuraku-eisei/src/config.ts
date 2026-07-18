/**
 * アプリ設定（このファイルだけ書き換えれば導入できます）
 *
 * 1. Firebase コンソールで新しいプロジェクトを作成し、ウェブアプリを追加
 * 2. 表示される firebaseConfig の値を下の FIREBASE_CONFIG に貼り付ける
 *    （または .env に VITE_FIREBASE_* を設定する。.env が優先されます）
 * 3. ADMIN_EMAIL を管理者アカウントのメールアドレスに合わせる
 *    ※ firestore.rules / storage.rules 内の管理者メールも同じ値にすること
 *
 * 詳しい手順は SETUP.md を参照してください。
 */

const env = import.meta.env;

export const APP_NAME = 'らくらく衛生管理';

/**
 * 管理者（サービス運営者）のメールアドレス。
 * このメールの Firebase Auth アカウントだけが店舗の追加・削除などを行える。
 * firestore.rules / storage.rules の isAdmin() と必ず一致させること。
 */
export const ADMIN_EMAIL: string = env.VITE_ADMIN_EMAIL ?? 'azumatori49@gmail.com';

export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};

/** Firebase 設定が入力済みかどうか（未設定なら画面に案内を出す） */
export const isFirebaseConfigured: boolean =
  FIREBASE_CONFIG.apiKey.length > 0 && FIREBASE_CONFIG.projectId.length > 0;
