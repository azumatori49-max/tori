import { useEffect, useRef, useState } from "react";

interface Props {
  index: number;
  file: File | null;
  onPick: (file: File) => void;
}

export const PhotoSlot = ({ index, file, onPick }: Props) => {
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

  const open = () => inputRef.current?.click();

  return (
    <button
      type="button"
      onClick={open}
      className={`relative aspect-square w-full overflow-hidden rounded-xl border-2 ${
        file ? "border-accent" : "border-dashed border-border bg-surface2"
      } flex items-center justify-center text-muted transition active:scale-[0.98]`}
    >
      {preview ? (
        <>
          <img src={preview} alt="" className="h-full w-full object-cover" />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">
            {index + 1}
          </span>
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
            再撮影
          </span>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl">📸</span>
          <span className="text-[11px] font-bold">{index + 1}</span>
          <span className="text-[10px]">タップして撮影</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </button>
  );
};
