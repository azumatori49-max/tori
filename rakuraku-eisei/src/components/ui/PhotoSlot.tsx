import { useRef } from 'react';

interface Props {
  index: number;
  url?: string;
  onPick: (file: File) => void;
}

export const PhotoSlot = ({ index, url, onPick }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
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
      className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-border bg-surface2 transition active:scale-95"
    >
      {url ? (
        <>
          <img src={url} alt={`スロット${index + 1}`} className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-white shadow">
            {index + 1}
          </span>
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
            再撮影
          </span>
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-muted">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8h2.5l1.5-2.5h8L17.5 8H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="text-[10px] font-bold">タップして撮影</span>
          <span className="text-[10px] opacity-60">#{index + 1}</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
    </button>
  );
};
