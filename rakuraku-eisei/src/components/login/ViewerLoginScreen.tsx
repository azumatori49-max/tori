import { useState } from 'react';
import { APP_NAME } from '../../config';

interface Props {
  onLoginViewer: (password: string) => Promise<string | null>;
}

/** 閲覧専用ページ（/view）のログイン画面 */
export const ViewerLoginScreen = ({ onLoginViewer }: Props) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('パスワードを入力してください');
      return;
    }
    setBusy(true);
    try {
      const err = await onLoginViewer(password);
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/logo.svg" alt="" className="mx-auto mb-3 h-24 w-24" />
          <h1 className="text-xl font-black text-text">{APP_NAME}</h1>
          <p className="mt-1 text-xs text-text-muted">閲覧専用ログイン</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-xs font-bold text-text-muted">
              閲覧用パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface2 px-3 py-2.5 text-sm"
              autoComplete="current-password"
              autoFocus
            />
          </div>
          {error && (
            <div className="rounded-lg bg-ng-bg px-3 py-2 text-xs font-bold text-ng">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-text-muted">
          提出状況と写真の確認のみできるページです
        </p>
      </div>
    </div>
  );
};
