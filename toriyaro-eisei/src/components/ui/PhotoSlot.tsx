import { useEffect, useRef, useState, type FC } from 'react';

interface Props {
  index: number;
  file: File | null;
  /** 既に提出済みの写真URL（file未選択時に表示） */
  existingUrl?: string;
  onPick: (file: File) => void;
  disabled?: boolean;
  label?: string;
  /** 'camera' = カメラ起動, 'library' = 写真フォルダから選択 */
  source?: 'camera' | 'library';
  /** ラベル下に表示する注意書き */
  note?: string;
  /** 参考写真のURL（指定時はボタンを表示） */
  helpImage?: string;
  onHelpClick?: (url: string) => void;
}

export const PhotoSlot: FC<Props> = ({
  index,
  file,
  existingUrl,
  onPick,
  disabled,
  label,
  source = 'camera',
  note,
  helpImage,
  onHelpClick,
}) => {
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
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`relative aspect-square w-full overflow-hidden rounded-2xl border-2 transition active:scale-95 ${
          displayUrl
            ? filePreview
              ? 'border-accent bg-surface'
              : 'border-ok bg-surface'
            : 'border-dashed border-border bg-surface2 hover:border-accent/60'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        {displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt={`photo ${index + 1}`}
              className="h-full w-full object-cover"
            />
            <span className="absolute left-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              {index + 1}
            </span>
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
              {isReplacing
                ? '差替予定'
                : filePreview
                  ? source === 'library'
                    ? '選び直す'
                    : '再撮影'
                  : '提出済み'}
            </span>
            {!filePreview && (
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-bold text-white drop-shadow">
                タップで{source === 'library' ? '選び直す' : '撮り直す'}
              </span>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-text-muted">
            <span className="text-2xl">{source === 'library' ? '🖼️' : ''}</span>
            <span className="text-[11px] font-bold">
              {source === 'library' ? 'フォルダから選択' : 'タップして撮影'}
            </span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          {...(source === 'camera' ? { capture: 'environment' as const } : {})}
          className="hidden"
          onChange={handleChange}
        />
      </button>
      {label && (
        <div className="px-1 text-center text-[11px] font-bold leading-tight text-text">
          {index + 1}. {label}
        </div>
      )}
      {note && (
        <div className="px-1 text-center text-[10px] leading-tight text-warn">
          {note}
        </div>
      )}
      {helpImage && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHelpClick?.(helpImage);
          }}
          className="mx-auto mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent active:scale-95"
        >
          参考写真を見る
        </button>
      )}
    </div>
  );
};
