import { useEffect, useState } from 'react';
import { LoginScreen } from './components/login/LoginScreen';
import { StoreTopScreen } from './components/store/StoreTopScreen';
import { UploadScreen } from './components/store/UploadScreen';
import { AdminScreen } from './components/admin/AdminScreen';
import { InAppBrowserGate } from './components/system/InAppBrowserGate';
import { AnonAuthGate } from './components/system/AnonAuthGate';
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

const AppInner = () => {
  const { auth, loginAsStore, loginAsAdmin, logout } = useAuth();
  const { stores, loading, error: storesError } = useStores();
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
        loadError={storesError}
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
  // ロードが終わっていて該当店舗が無い = 保存済みのログインが古い／DBに無い
  if (!loading && !store) {
    logout();
    return null;
  }
  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-text-muted">店舗情報を読み込み中…</p>
        {storesError && (
          <p className="max-w-xs rounded-lg bg-warn-bg px-3 py-2 text-[11px] font-bold text-warn">
            {storesError}
          </p>
        )}
        <button
          type="button"
          onClick={logout}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-text-muted hover:text-accent"
        >
          ログイン画面に戻る
        </button>
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

const App = () => (
  <>
    <AnonAuthGate>
      <AppInner />
    </AnonAuthGate>
    <VersionBadge />
    <InAppBrowserGate />
  </>
);

export default App;
