import { useEffect } from "react";

export const Lightbox = ({ src, onClose }: { src: string; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 animate-fade-in"
      onClick={onClose}
    >
      <img src={src} alt="" className="max-h-[92vh] max-w-[92vw] object-contain" />
      <button
        type="button"
        aria-label="閉じる"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
};
