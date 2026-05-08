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
        className="h-16 w-16 rounded-full object-cover opacity-60"
      />
      {error ? (
        <>
          <p className="max-w-xs text-xs font-bold leading-relaxed text-ng">{error}</p>
          <button
            type="button"
            onClick={() => setRetryToken((n) => n + 1)}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white"
          >
            もう一度試す
          </button>
        </>
      ) : (
        <p className="text-xs text-text-muted">セキュア接続を確立しています…</p>
      )}
    </div>
  );
};
