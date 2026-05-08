import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import './styles.css';

// グローバルエラーをコンソールと画面のどちらにも出す
window.addEventListener('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('[window.error]', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledrejection]', e.reason);
});

const root = document.getElementById('root');
if (!root) {
  document.body.innerHTML =
    '<div style="padding:24px;font-family:sans-serif">root 要素が見つかりません</div>';
} else {
  try {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  } catch (e) {
    root.innerHTML = `<div style="padding:24px;font-family:sans-serif;color:#c0392b"><b>初期化失敗</b><br><pre style="white-space:pre-wrap">${
      (e as Error)?.stack ?? String(e)
    }</pre></div>`;
  }
}
