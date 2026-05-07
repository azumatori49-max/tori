import { useEffect, useRef, useState } from 'react';
import { CameraCapture } from './CameraCapture';

export type SlotStatus = 'empty' | 'captured' | 'uploading' | 'uploaded' | 'failed';

interface Props {
  index: number;
  imageUrl: string | null;
  status: SlotStatus;
  onCapture: (file: File) => void;
  disabled?: boolean;
  label?: string;
  mode?: 'camera' | 'gallery';
}

export const PhotoSlot = ({
  index,
  imageUrl,
  status,
  onCapture,
  disabled,
  label,
  mode = 'camera',
}: Props) => {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!localFile) {
      setLocalUrl(null);
      return;
    }
    const url = URL.createObjectURL(localFile);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localFile]);

  useEffect(() => {
    if (status === 'uploaded' && imageUrl) {
      setLocalFile(null);
    }
  }, [status, imageUrl]);

  const previewUrl = imageUrl ?? localUrl;

  const openInput = () => {
    if (disabled) return;
    if (mode === 'gallery') {
      galleryInputRef.current?.click();
    } else {
      setCameraOpen(true);
    }
  };

  const handleCameraCaptured = (f: File) => {
    setLocalFile(f);
    onCapture(f);
  };

  const handleGalleryPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) {
      setLocalFile(f);
      onCapture(f);
    }
  };

  const borderClass = previewUrl
    ? status === 'failed'
      ? 'border-ng shadow-sm'
      : 'border-accent shadow-sm'
    : 'border-dashed border-border bg-surface2 hover:border-accent/60';

  const emptyHint = mode === 'gallery' ? 'フォルダから選択' : 'タップして撮影';

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={openInput}
        disabled={disabled || status === 'uploading'}
        className={`relative aspect-square w-full rounded-2xl overflow-hidden border-2 transition active:scale-[0.97] ${borderClass}`}
        aria-label={`スロット ${index + 1}${label ? ` ${label}` : ''}`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={`撮影 ${index + 1}`} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-text-muted">
            {mode === 'gallery' ? (
              <svg
                viewBox="0 0 24 24"
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="11" r="2" />
                <path d="M21 17l-5-5-4 4-3-3-6 6" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9.5a2 2 0 0 1 2-2h2.2l1.4-2h6.8l1.4 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z" />
                <circle cx="12" cy="13.5" r="3.6" />
              </svg>
            )}
            <span className="text-[11px] font-bold tracking-wider">{emptyHint}</span>
          </div>
        )}

        <span
          className={`absolute top-2 left-2 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shadow ${
            previewUrl ? 'bg-accent text-white' : 'bg-border text-text-muted'
          }`}
        >
          {index + 1}
        </span>

        {status === 'uploading' ? (
          <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 text-text text-[11px] font-bold">
              <span className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              送信中
            </span>
          </span>
        ) : null}

        {status === 'captured' ? (
          <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-warn text-white text-[11px] font-bold tracking-wider">
            未送信
          </span>
        ) : null}

        {status === 'uploaded' ? (
          <span className="absolute bottom-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-ok text-white shadow">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="5 12.5 10 17.5 19 7.5" />
            </svg>
          </span>
        ) : null}

        {status === 'failed' ? (
          <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-ng text-white text-[11px] font-bold tracking-wider">
            失敗
          </span>
        ) : null}

        {status !== 'empty' && status !== 'uploading' ? (
          <span className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-bold tracking-wider">
            {mode === 'gallery' ? '選び直し' : '再撮影'}
          </span>
        ) : null}
      </button>

      {label ? (
        <span className="text-[10px] leading-tight font-bold text-text text-center px-0.5 break-keep">
          {label}
        </span>
      ) : null}

      {mode === 'gallery' ? (
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGalleryPick}
        />
      ) : (
        <CameraCapture
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={handleCameraCaptured}
          title={label ? `${index + 1}. ${label}` : `スロット ${index + 1} を撮影`}
        />
      )}
    </div>
  );
};
