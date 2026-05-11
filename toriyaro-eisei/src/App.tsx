import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useStores } from './hooks/useStores';
import { INITIAL_STORES } from './data/stores';
import { LoginScreen } from './components/login/LoginScreen';
import { StoreTopScreen } from './components/store/StoreTopScreen';
import { UploadScreen } from './components/store/UploadScreen';
import { AdminScreen } from './components/admin/AdminScreen';
import type { ReportType, Screen } from './types';

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

  const effectiveStores = useMemo(() => {
    return Object.keys(stores).length > 0 ? stores : INITIAL_STORES;
  }, [stores]);

  const storeName = useMemo(() => {
    if (!auth.storeKey || auth.storeKey === '__admin__') return '';
    return effectiveStores[auth.storeKey]?.name ?? '';
  }, [auth.storeKey, effectiveStores]);

  const handleLogout = () => {
    logout();
    setScreen('login');
  };

  if (screen === 'login' || (!auth.storeKey && !auth.isAdmin)) {
    return <LoginScreen onLoginStore={loginStore} onLoginAdmin={loginAdmin} />;
  }

  if (screen === 'admin' && auth.isAdmin) {
    return <AdminScreen onLogout={handleLogout} />;
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

  return <LoginScreen onLoginStore={loginStore} onLoginAdmin={loginAdmin} />;
}
