import { useEffect, useState, type FC } from 'react';
import type { ScheduleVideo } from '../../types';

interface Props {
  video: ScheduleVideo | null;
  onClose: () => void;
}

/**
 * 参考動画を画面いっぱいで再生するモーダル。
 * - 通信が遅い場合を考え、最初は再生ボタンだけを出し、押してから動画を読み込む
 * - 閉じる（×ボタン／外側タップ）と動画要素ごと外れるので再生も止まる
 * - upload は <video>、youtube/vimeo は 16:9 の iframe。どちらも自動再生なし
 */
export const VideoModal: FC<Props> = ({ video, onClose }) => {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setStarted(false);
  }, [video]);

  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video, onClose]);

  if (!video) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
        aria-label="閉じる"
      >
        ×
      </button>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        {video.title && (
          <p className="mb-2 truncate px-1 text-sm font-bold text-white">{video.title}</p>
        )}
        <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
          {!started ? (
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-white"
            >
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl">
                ▶
              </span>
              <span className="text-xs font-bold">タップして再生</span>
            </button>
          ) : video.type === 'upload' ? (
            <video
              src={video.url}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
            />
          ) : (
            <iframe
              src={video.url}
              title={video.title ?? '参考動画'}
              className="h-full w-full"
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-white/70">外側をタップすると閉じます</p>
      </div>
    </div>
  );
};
