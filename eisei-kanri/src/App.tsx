import { useState } from 'react';
import { LoginScreen } from './components/login/LoginScreen';
import { StoreTopScreen } from './components/store/StoreTopScreen';
import { UploadScreen } from './components/store/UploadScreen';
import { AdminScreen } from './components/admin/AdminScreen';
import { InAppBrowserGate } from './components/ui/InAppBrowserGate';
import { useAuth } from './hooks/useAuth';
import { useStores } from './hooks/useStores';
import type { ReportType, Screen } from './types';

const App = () => {
  const { auth, saved, loginAsStore, loginAsAdmin, logout, forgetSavedCredentials } = useAuth();
  const { stores, loading: storesLoading } = useStores();
  const [screen, setScreen] = useState<Screen>('store-top');
  const [uploadType, setUploadType] = useState<ReportType>('daily');

  const renderApp = () => {
    if (!auth.storeKey) {
      return (
        <LoginScreen
          stores={stores}
          storesLoading={storesLoading}
          saved={saved}
          onLoginStore={(key, password, remember) => {
            loginAsStore(key, password, remember);
            setScreen('store-top');
          }}
          onLoginAdmin={(password, remember) => loginAsAdmin(password, remember)}
          onForget={forgetSavedCredentials}
        />
      );
    }

    if (auth.isAdmin) {
      return <AdminScreen stores={stores} onLogout={logout} />;
    }

    const storeKey = auth.storeKey;
    const store = stores[storeKey];

    if (!store && !storesLoading) {
      return (
        <div className="min-h-full flex flex-col items-center justify-center p-6 text-center gap-3">
          <p className="font-bold">店舗情報を取得できませんでした</p>
          <p className="text-sm text-text-muted">管理者にお問い合わせください。</p>
          <button
            type="button"
            onClick={logout}
            className="text-sm font-bold bg-accent text-white rounded-xl px-5 py-2"
          >
            ログアウト
          </button>
        </div>
      );
    }

    if (!store) {
      return (
        <div className="min-h-full flex items-center justify-center text-text-muted text-sm">
          読み込み中...
        </div>
      );
    }

    if (screen === 'upload') {
      return (
        <UploadScreen
          storeKey={storeKey}
          storeName={store.name}
          reportType={uploadType}
          onBack={() => setScreen('store-top')}
        />
      );
    }

    return (
      <StoreTopScreen
        storeKey={storeKey}
        storeName={store.name}
        onLogout={logout}
        onOpenUpload={(type) => {
          setUploadType(type);
          setScreen('upload');
        }}
      />
    );
  };

  return (
    <>
      {renderApp()}
      <InAppBrowserGate />
    </>
  );
};

export default App;
