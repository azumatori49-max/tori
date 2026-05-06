import { useEffect, useState } from 'react';
import { LoginScreen } from './components/login/LoginScreen';
import { StoreTopScreen } from './components/store/StoreTopScreen';
import { UploadScreen } from './components/store/UploadScreen';
import { AdminScreen } from './components/admin/AdminScreen';
import { useAuth } from './hooks/useAuth';
import { useStores } from './hooks/useStores';
import type { ReportType, Screen, StoreKey } from './types';

export const App = () => {
  const { auth, loginAsStore, loginAsAdmin, logout } = useAuth();
  const { stores, loading: storesLoading } = useStores();
  const [screen, setScreen] = useState<Screen>('login');
  const [reportType, setReportType] = useState<ReportType>('daily');

  useEffect(() => {
    if (auth.isAdmin) {
      setScreen('admin');
    } else if (auth.storeKey && auth.storeKey !== '__admin__') {
      setScreen((prev) => (prev === 'upload' ? prev : 'store-top'));
    } else {
      setScreen('login');
    }
  }, [auth]);

  const handleStoreLogin = (key: StoreKey) => {
    loginAsStore(key);
  };

  const handleLogout = () => {
    logout();
  };

  if (screen === 'login') {
    return <LoginScreen onStoreLogin={handleStoreLogin} onAdminLogin={loginAsAdmin} />;
  }

  if (screen === 'admin') {
    return <AdminScreen onLogout={handleLogout} />;
  }

  const storeKey = auth.storeKey && auth.storeKey !== '__admin__' ? auth.storeKey : null;
  if (!storeKey) {
    return <LoginScreen onStoreLogin={handleStoreLogin} onAdminLogin={loginAsAdmin} />;
  }

  const storeName =
    stores[storeKey]?.name ?? (storesLoading ? '読み込み中…' : '店舗');

  if (screen === 'upload') {
    return (
      <UploadScreen
        storeKey={storeKey}
        storeName={storeName}
        type={reportType}
        onBack={() => setScreen('store-top')}
      />
    );
  }

  return (
    <StoreTopScreen
      storeKey={storeKey}
      storeName={storeName}
      onOpenReport={(t) => {
        setReportType(t);
        setScreen('upload');
      }}
      onLogout={handleLogout}
    />
  );
};
