import { useEffect, useState, type FC } from 'react';
import { subscribeSync, syncNow, type SyncStatus } from '../../lib/syncEngine';

export const SyncStatusBar: FC = () => {
  const [s, setS] = useState<SyncStatus | null>(null);

  useEffect(() => subscribeSync(setS), []);

  if (!s) return null;
  const show = !s.online || s.pending > 0 || s.phase === 'syncing' || s.phase === 'done' || s.phase === 'error';
  if (!show) return null;

  const bg = !s.online
    ? 'bg-text-muted'
    : s.phase === 'error'
      ? 'bg-ng'
      : s.phase === 'done'
        ? 'bg-ok'
        : 'bg-accent';

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[70] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-1.5 text-[11px] font-bold text-white ${bg}`}
    >
      <span>{s.online ? 'オンライン' : 'オフライン'}</span>
      {s.pending > 0 && <span>未送信 {s.pending}件</span>}
      {s.message && <span>{s.message}</span>}
      {s.pending > 0 && s.online && s.phase !== 'syncing' && (
        <button
          type="button"
          onClick={() => void syncNow()}
          className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-accent"
        >
          今すぐ再送
        </button>
      )}
    </div>
  );
};