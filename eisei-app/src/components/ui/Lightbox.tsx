import type { FC } from 'react';

interface Props {
  url: string | null;
  onClose: () => void;
}

export const Lightbox: FC<Props> = ({ url, onClose }) => {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white"
      >
        ×
      </button>
      <img
        src={url}
        alt="拡大"
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};
