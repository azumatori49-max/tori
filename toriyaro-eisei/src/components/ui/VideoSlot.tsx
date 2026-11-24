import { useEffect, useRef, useState, type FC } from 'react';

interface Props {
  index: number;
  file: File | null;
  /** 既に提出済みの動画URL（file未選択時に表示） */
  existingUrl?: string;
  onPick: (file: File) => void;
  disabled?: boolean;
}

/** 年間スケジュールの動画項目用の1枠（撮影またはフォルダから1本）。PhotoSlot の動画版 */
export const VideoSlot: FC<Props> = ({ index, file, existingUrl, onPick, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const displayUrl = filePreview ?? existingUrl ?? null;
  const isReplacing = !!filePreview && !!existingUrl;

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-2xl border-2 ${
          displayUrl
            ? filePreview
              ? 'border-accent bg-black'
              : 'border-ok bg-black'
            : 'border-dashed border-border bg-surface2'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        {displayUrl ? (
          <>
            <video
              src={displayUrl}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
            />
            <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              {index + 1}
            </span>
            <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white">
              {isReplacing ? '差替予定' : filePreview ? '送信前' : '提出済み'}
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => !disabled && inputRef.current?.click()}
            disabled={disabled}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-muted transition active:scale-95"
          >
            <span className="text-2xl">🎥</span>
            <span className="text-xs font-bold">動画を撮影 / フォルダから選択</span>
          </button>
        )}
        {/* capture を付けないので、スマホでは「撮影」と「フォルダから選択」の両方を選べる */}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
        />
      </div>
      {displayUrl && (
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled}
          className="rounded-lg border border-border bg-surface py-1.5 text-xs font-bold text-text-muted disabled:opacity-50"
        >
          撮り直す / 選び直す
        </button>
      )}
    </div>
  );
};
