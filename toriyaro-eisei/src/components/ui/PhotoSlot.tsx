import { useEffect, useState } from 'react';
import { CameraCapture } from './CameraCapture';

interface Props {
  index: number;
  file: File | null;
  onCapture: (file: File) => void;
  disabled?: boolean;
}

export const PhotoSlot = ({ index, file, onCapture, disabled }: Props) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleClick = () => {
    if (disabled) return;
    setCameraOpen(true);
  };

  const handleCapture = (f: File) => {
    onCapture(f);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`relative aspect-square w-full rounded-2xl overflow-hidden border-2 transition active:scale-[0.97] ${
          previewUrl
            ? 'border-accent shadow-sm'
            : 'border-dashed border-border bg-surface2 hover:border-accent/60'
        }`}
        aria-label={`スロット ${index + 1}`}
      >
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt={`撮影 ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <span className="absolute top-2 left-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-bold shadow">
              {index + 1}
            </span>
            <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-bold tracking-wider">
              再撮影
            </span>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-text-muted">
            <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5a2 2 0 0 1 2-2h2.2l1.4-2h6.8l1.4 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z" />
              <circle cx="12" cy="13.5" r="3.6" />
            </svg>
            <span className="text-[11px] font-bold tracking-wider">タップして撮影</span>
            <span className="absolute top-2 left-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-border text-text-muted text-xs font-bold">
              {index + 1}
            </span>
          </div>
        )}
      </button>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
        title={`スロット ${index + 1} を撮影`}
      />
    </>
  );
};
