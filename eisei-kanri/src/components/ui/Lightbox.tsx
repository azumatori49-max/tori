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
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-2xl flex items-center justify-center"
        onClick={onClose}
        aria-label="閉じる"
      >
        ×
      </button>
      <img
        src={src}
        alt="preview"
        className="max-w-full max-h-full object-contain p-4"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};
