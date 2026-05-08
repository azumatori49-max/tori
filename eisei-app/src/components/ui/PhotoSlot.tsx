import { useEffect, useRef, useState, type FC } from 'react';

interface Props {
  index: number;
  file: File | null;
  onPick: (file: File) => void;
  disabled?: boolean;
}

export const PhotoSlot: FC<Props> = ({ index, file, onPick, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    e.target.value = '';
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`relative aspect-square w-full overflow-hidden rounded-2xl border-2 transition active:scale-95 ${
        preview
          ? 'border-accent bg-surface'
          : 'border-dashed border-border bg-surface2 hover:border-accent/60'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {preview ? (
        <>
          <img src={preview} alt={`photo ${index + 1}`} className="h-full w-full object-cover" />
          <span className="absolute left-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
            {index + 1}
          </span>
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
            再撮影
          </span>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-text-muted">
          <span className="text-2xl">📸</span>
          <span className="text-[11px] font-bold">{index + 1}枚目</span>
          <span className="text-[10px]">タップして撮影</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </button>
  );
};
