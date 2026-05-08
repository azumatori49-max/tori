import type { FC } from 'react';

interface Props {
  open: boolean;
  message?: string;
}

export const SuccessOverlay: FC<Props> = ({ open, message = '提出完了' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
      <div className="mx-6 max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-ok-bg text-4xl text-ok">
          ✓
        </div>
        <p className="text-lg font-bold">{message}</p>
        <p className="mt-1 text-sm text-text-muted">ありがとうございました</p>
      </div>
    </div>
  );
};
