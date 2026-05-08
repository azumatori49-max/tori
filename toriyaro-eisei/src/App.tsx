import { useEffect, useState } from 'react';
import { LoginScreen } from './components/login/LoginScreen';
import { StoreTopScreen } from './components/store/StoreTopScreen';
import { UploadScreen } from './components/store/UploadScreen';
import { AdminScreen } from './components/admin/AdminScreen';
import { useAuth } from './hooks/useAuth';
import { useStores } from './hooks/useStores';
import type { ReportType, Screen } from './types';

declare const __BUILD_TIME__: string;
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev';

const VersionBadge = () => (
  <div className="pointer-events-none fixed bottom-1 right-1 z-50 select-none rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white/80">
    v {BUILD_TIME}
  </div>
);

const App = () => {
  const { auth, loginAsStore, loginAsAdmin, logout } = useAuth();
  const { stores, loading } = useStores();
  const [screen, setScreen] = useState<Screen>(() =>
    auth.isAdmin ? 'admin' : auth.storeKey ? 'store-top' : 'login',
  );
  const [reportType, setReportType] = useState<ReportType>('daily');

  useEffect(() => {
    if (auth.isAdmin) setScreen('admin');
    else if (auth.storeKey) setScreen((s) => (s === 'login' ? 'store-top' : s));
    else setScreen('login');
  }, [auth.isAdmin, auth.storeKey]);

  let body: JSX.Element;
  if (screen === 'login') {
    body = (
      <LoginScreen
        stores={stores}
        loading={loading}
        onLoginStore={(k) => {
          loginAsStore(k);
          setScreen('store-top');
        }}
        onLoginAdmin={() => {
          loginAsAdmin();
          setScreen('admin');
        }}
      />
    );
  } else if (screen === 'admin') {
    body = <AdminScreen stores={stores} onLogout={logout} />;
  } else {
    const storeKey = auth.storeKey;
    if (!storeKey || storeKey === '__admin__') {
      logout();
      return null;
    }
    const store = stores[storeKey];
    if (!store) {
      body = (
        <div className="min-h-screen flex items-center justify-center text-sm text-text-muted">
          店舗情報を読み込み中…
        </div>
      );
    } else if (screen === 'upload') {
      body = (
        <UploadScreen
          storeKey={storeKey}
          storeName={store.name}
          type={reportType}
          onBack={() => setScreen('store-top')}
        />
      );
    } else {
      body = (
        <StoreTopScreen
          storeKey={storeKey}
          storeName={store.name}
          onLogout={logout}
          onOpenReport={(t) => {
            setReportType(t);
            setScreen('upload');
          }}
        />
      );
    }
  }

  return (
    <>
      {body}
      <VersionBadge />
    </>
  );
};

export default App;
