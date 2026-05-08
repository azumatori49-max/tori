import { useRef } from 'react';

interface Props {
  index: number;
  previewUrl: string | null;
  onSelect: (file: File) => void;
  disabled?: boolean;
}

export const PhotoSlot = ({ index, previewUrl, onSelect, disabled }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelect(file);
    e.target.value = '';
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`relative aspect-square w-full rounded-xl overflow-hidden border-2 transition active:scale-95 ${
        previewUrl
          ? 'border-accent'
          : 'border-dashed border-border bg-surface2 hover:border-accent/60'
      } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {previewUrl ? (
        <>
          <img src={previewUrl} alt={`photo-${index + 1}`} className="w-full h-full object-cover" />
          <span className="absolute top-1 left-1 bg-accent text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
            {index + 1}
          </span>
          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            再撮影
          </span>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-text-muted gap-1">
          <span className="text-3xl">📸</span>
          <span className="text-[11px] font-bold">タップして撮影</span>
          <span className="text-[10px] text-text-muted/80">{index + 1}枚目</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={'camera' as unknown as 'environment'}
        onChange={handleChange}
        className="hidden"
      />
    </button>
  );
};
