import { useEffect, useState } from 'react';
import { LoginScreen } from './components/login/LoginScreen';
import { StoreTopScreen } from './components/store/StoreTopScreen';
import { UploadScreen } from './components/store/UploadScreen';
import { AdminScreen } from './components/admin/AdminScreen';
import { useAuth } from './hooks/useAuth';
import { useStores } from './hooks/useStores';
import type { ReportType, Screen } from './types';

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

  if (screen === 'login') {
    return (
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
  }

  if (screen === 'admin') {
    return <AdminScreen stores={stores} onLogout={logout} />;
  }

  const storeKey = auth.storeKey;
  if (!storeKey || storeKey === '__admin__') {
    logout();
    return null;
  }
  const store = stores[storeKey];
  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-text-muted">
        店舗情報を読み込み中…
      </div>
    );
  }

  if (screen === 'upload') {
    return (
      <UploadScreen
        storeKey={storeKey}
        storeName={store.name}
        type={reportType}
        onBack={() => setScreen('store-top')}
      />
    );
  }

  return (
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
};

export default App;
