import { useEffect, useState, type ReactNode } from 'react';
import { LoginScreen } from './components/login/LoginScreen';
import { StoreTopScreen } from './components/store/StoreTopScreen';
import { UploadScreen } from './components/store/UploadScreen';
import { AdminScreen } from './components/admin/AdminScreen';
import { InAppBrowserGate } from './components/system/InAppBrowserGate';
import { AnonAuthGate } from './components/system/AnonAuthGate';
import { UpdateNotifier } from './components/system/UpdateNotifier';
import { useAuth } from './hooks/useAuth';
import { useStores } from './hooks/useStores';
import type { ReportType, Screen } from './types';
import { FeedbackWidget } from './components/feedback/FeedbackWidget';
import { HistoryScreen } from './components/store/HistoryScreen';
import { ReferralFormScreen } from './components/store/ReferralFormScreen';
import { ScheduleUploadScreen } from './components/store/ScheduleUploadScreen';
import { ViewerScreen } from './components/viewer/ViewerScreen';
import { isMobileDevice } from './lib/device';
import type { ReferralRequest } from './types';
import { storeSurveyAccessUrl, storeSurveyUrl } from './lib/storeSurvey';

const AppInner = () => {
  const { auth, loginAsStore, loginAsAdmin, logout } = useAuth();
  const { stores, loading, loaded, error: storesError } = useStores();
  const [screen, setScreen] = useState<Screen>(() =>
    auth.isAdmin ? 'admin' : auth.storeKey ? 'store-top' : 'login',
  );
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [referralInitial, setReferralInitial] = useState<ReferralRequest | null>(
    null,
  );
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [loginStoreKey, setLoginStoreKey] = useState(() => {
    const key = new URLSearchParams(window.location.search).get('surveyLogin') || '';
    return storeSurveyUrl(key) ? key : '';
  });
  const [loginNotice, setLoginNotice] = useState<string | null>(loginStoreKey ? 'いつもの店舗ログインでアンケートを開けます。' : null);
  const [surveyNotice, setSurveyNotice] = useState<string | undefined>();

  useEffect(() => {
    if (auth.isAdmin) {
      setScreen('admin');
    } else if (auth.storeKey) {
      setScreen((s) => (s === 'login' || s === 'admin' ? 'store-top' : s));
    } else {
      setScreen('login');
    }
  }, [auth.isAdmin, auth.storeKey]);

  useEffect(() => {
    if (!loginStoreKey) return;
    setScreen('login');
    const url = new URL(window.location.href);
    url.searchParams.delete('surveyLogin');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, []);

  // 店舗一覧を正常に受信できた（loaded）うえで自店が無いときだけログアウトする。
  // 取得失敗・遅延（loaded=false）ではログアウトせず「店舗情報を読み込み中…」のまま待ち、
  // データが届けば自動で店舗トップに戻る。
  useEffect(() => {
    if (
      loaded &&
      auth.storeKey &&
      auth.storeKey !== '__admin__' &&
      !stores[auth.storeKey]
    ) {
      logout();
    }
  }, [loaded, auth.storeKey, stores, logout]);

  const feedbackRight =
    screen === 'upload' ||
    screen === 'schedule-upload' ||
    screen === 'history' ||
    screen === 'viewer' ||
    screen === 'referral-form';

  let content: ReactNode;

  if (screen === 'viewer') {
    content = <ViewerScreen stores={stores} onBack={() => setScreen('login')} />;
  } else if (screen === 'login') {
    content = (
      <LoginScreen
        stores={stores}
        loading={loading}
        loadError={storesError}
        initialStoreKey={loginStoreKey}
        notice={loginNotice}
        onLoginStore={(k, surveyWarning) => {
          loginAsStore(k);
          setLoginNotice(null);
          setSurveyNotice(surveyWarning);
          setScreen('store-top');
        }}
        onLoginAdmin={() => {
          loginAsAdmin();
          setScreen('admin');
        }}
        onOpenViewer={() => setScreen('viewer')}
      />
    );
  } else if (screen === 'admin') {
    content = <AdminScreen stores={stores} onLogout={logout} />;
  } else {
        const storeKey = auth.storeKey;
    if (!isMobileDevice()) {
      content = (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm font-bold">PCでは店舗画面は利用できません</p>
          <p className="text-xs text-text-muted">
            衛生チェックの提出はスマートフォンから行ってください。<br />
            PCでは管理者ログインのみ利用できます。
          </p>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-text-muted hover:text-accent"
          >
            ログイン画面へ
          </button>
        </div>
      );
    } else if (!storeKey || storeKey === '__admin__') {
      content = (
        <div className="min-h-screen flex items-center justify-center text-sm text-text-muted">
          ログイン画面に戻ります…
        </div>
      );
    } else {
      const store = stores[storeKey];
      if (!store) {
        content = (
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
      } else if (screen === 'history') {
        content = (
          <HistoryScreen
            storeKey={storeKey}
            storeName={store.name}
            createdAt={store.createdAt}
            onBack={() => setScreen('store-top')}
          />
        );
      } else if (screen === 'upload') {
        content = (
          <UploadScreen
            storeKey={storeKey}
            storeName={store.name}
            type={reportType}
            onBack={() => setScreen('store-top')}
          />
        );
      } else if (screen === 'schedule-upload' && scheduleId) {
        content = (
          <ScheduleUploadScreen
            storeKey={storeKey}
            storeName={store.name}
            scheduleId={scheduleId}
            onBack={() => {
              setScheduleId(null);
              setScreen('store-top');
            }}
          />
        );
      } else if (screen === 'referral-form') {
        content = (
          <ReferralFormScreen
            storeKey={storeKey}
            storeName={store.name}
            initial={referralInitial}
            onBack={() => {
              setReferralInitial(null);
              setScreen('store-top');
            }}
            onSubmitted={() => {
              setReferralInitial(null);
              setScreen('store-top');
            }}
          />
        );
      } else {
        content = (
          <StoreTopScreen
            storeKey={storeKey}
            storeName={store.name}
            stores={stores}
            onLogout={logout}
            onOpenReport={(t) => {
              setReportType(t);
              setScreen('upload');
            }}
            onOpenHistory={() => setScreen('history')}
            surveyNotice={surveyNotice}
            onOpenSurvey={() => {
              const url = storeSurveyAccessUrl(storeKey);
              if (url) {
                window.location.assign(url);
              } else {
                setLoginStoreKey(storeKey);
                setLoginNotice('アンケートを開くため、一度だけいつもの店舗ログインをお願いします。');
                setScreen('login');
              }
            }}
            onOpenReferral={(init) => {
              setReferralInitial(init ?? null);
              setScreen('referral-form');
            }}
            onOpenSchedule={(id) => {
              setScheduleId(id);
              setScreen('schedule-upload');
            }}
          />
        );
      }
    }
  }

  return (
    <>
      {content}
      <FeedbackWidget alignRight={feedbackRight} />
    </>
  );
};

const App = () => (
  <>
    <AnonAuthGate>
      <AppInner />
    </AnonAuthGate>
    <UpdateNotifier />
    <InAppBrowserGate />
  </>
);

export default App;
