import { useEffect } from 'react';

interface Props {
  src: string | null;
  onClose: () => void;
}

export const Lightbox = ({ src, onClose }: Props) => {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-fadeIn p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt="プレビュー"
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-xl flex items-center justify-center hover:bg-white/20 transition"
        aria-label="閉じる"
      >
        ×
      </button>
    </div>
  );
};
