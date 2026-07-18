import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useStores } from './hooks/useStores';
import { LoginScreen } from './components/login/LoginScreen';
import { AdminLoginScreen } from './components/login/AdminLoginScreen';
import { StoreTopScreen } from './components/store/StoreTopScreen';
import { UploadScreen } from './components/store/UploadScreen';
import { AdminScreen } from './components/admin/AdminScreen';
import { APP_NAME, isFirebaseConfigured } from './config';
import type { ReportType, Screen } from './types';

/** /admin で開いているか（管理者専用ページ。店舗一覧には出さない） */
const isAdminRoute = window.location.pathname.replace(/\/+$/, '').endsWith('/admin');

export default function App() {
  const { auth, loginStore, loginAdmin, logout } = useAuth();
  const { stores } = useStores();
  const [screen, setScreen] = useState<Screen>('login');
  const [uploadType, setUploadType] = useState<ReportType>('daily');

  useEffect(() => {
    if (auth.isAdmin) {
      setScreen('admin');
    } else if (auth.storeKey && auth.storeKey !== '__admin__') {
      setScreen((s) => (s === 'upload' ? s : 'store-top'));
    } else {
      setScreen('login');
    }
  }, [auth]);

  const storeName = useMemo(() => {
    if (!auth.storeKey || auth.storeKey === '__admin__') return '';
    return stores[auth.storeKey]?.name ?? '';
  }, [auth.storeKey, stores]);

  if (!isFirebaseConfigured) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 text-sm text-text shadow-sm">
          <h1 className="mb-2 text-base font-black">{APP_NAME} — 初期設定が必要です</h1>
          <p className="text-text-muted">
            Firebase の接続情報が未設定です。
            <code className="mx-1 rounded bg-surface2 px-1">src/config.ts</code>
            （または .env）に Firebase プロジェクトの設定を入力してください。
            手順は SETUP.md を参照してください。
          </p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    void logout();
    setScreen('login');
  };

  // ── 管理者専用ページ（/admin） ──
  if (isAdminRoute) {
    if (auth.isAdmin) {
      return <AdminScreen onLogout={handleLogout} />;
    }
    return <AdminLoginScreen onLoginAdmin={loginAdmin} />;
  }

  // ── 店舗用ページ（/） ──
  // 管理者としてログイン済みなら管理者ページへ移動
  if (auth.isAdmin) {
    window.location.replace('/admin');
    return null;
  }

  if (screen === 'login' || !auth.storeKey) {
    return <LoginScreen onLoginStore={loginStore} />;
  }

  if (auth.storeKey && auth.storeKey !== '__admin__') {
    if (screen === 'upload') {
      return (
        <UploadScreen
          storeKey={auth.storeKey}
          storeName={storeName}
          type={uploadType}
          onBack={() => setScreen('store-top')}
          onDone={() => setScreen('store-top')}
        />
      );
    }
    return (
      <StoreTopScreen
        storeKey={auth.storeKey}
        storeName={storeName}
        onLogout={handleLogout}
        onStart={(type) => {
          setUploadType(type);
          setScreen('upload');
        }}
      />
    );
  }

  return <LoginScreen onLoginStore={loginStore} />;
}
