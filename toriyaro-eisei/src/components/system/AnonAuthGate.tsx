import { useEffect, useState, type FC, type ReactNode } from 'react';
import { ensureAnonymousAuth } from '../../lib/firebase';

interface Props {
  children: ReactNode;
}

export const AnonAuthGate: FC<Props> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setReady(false);
    ensureAnonymousAuth()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  if (ready) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <img
        src="/logo.png"
        alt=""
        className="h-20 w-20 rounded-full object-cover shadow"
      />
      {error ? (
        <>
          <h2 className="text-base font-black text-ng">接続できませんでした</h2>
          <p className="max-w-xs text-xs font-bold leading-relaxed text-text">{error}</p>
          <button
            type="button"
            onClick={() => setRetryToken((n) => n + 1)}
            className="rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow"
          >
            もう一度試す
          </button>
        </>
      ) : (
        <>
          <p className="text-base font-bold text-text">セキュア接続を確立しています…</p>
          <p className="text-[11px] text-text-muted">10秒以上かかる場合は通信状況をご確認ください</p>
        </>
      )}
    </div>
  );
};
