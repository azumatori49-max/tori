import type { FC } from 'react';

interface Props {
  url: string | null;
  onClose: () => void;
  /** 前後の写真へ移動（渡したときだけボタンを出す） */
  onPrev?: () => void;
  onNext?: () => void;
  /** 写真の下に出す説明（店名など） */
  caption?: string;
  /** 保存ボタン（渡したときだけ出す） */
  onSave?: () => void;
}

export const Lightbox: FC<Props> = ({ url, onClose, onPrev, onNext, caption, onSave }) => {
  if (!url) return null;
  const navCls =
    'absolute top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-white disabled:opacity-30';
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white"
      >
        ×
      </button>
      <img
        src={url}
        alt="拡大"
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {onSave && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white"
        >
          保存
        </button>
      )}
      {caption && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
          {caption}
        </p>
      )}
      {(onPrev || onNext) && (
        <>
          <button
            type="button"
            aria-label="前へ"
            disabled={!onPrev}
            onClick={(e) => {
              e.stopPropagation();
              onPrev?.();
            }}
            className={`${navCls} left-2`}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="次へ"
            disabled={!onNext}
            onClick={(e) => {
              e.stopPropagation();
              onNext?.();
            }}
            className={`${navCls} right-2`}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
};
