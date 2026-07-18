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

// rakuraku-kanri プロジェクトの接続情報（.env があればそちらが優先）
export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyClnKoyIFNqLJjAxHL-G8vc3mQ5jvWiywU',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'rakuraku-kanri.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'rakuraku-kanri',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'rakuraku-kanri.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '513779387113',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:513779387113:web:d4cc0ff9455df0f1f63e78',
};

/** Firebase 設定が入力済みかどうか（未設定なら画面に案内を出す） */
export const isFirebaseConfigured: boolean =
  FIREBASE_CONFIG.apiKey.length > 0 && FIREBASE_CONFIG.projectId.length > 0;
