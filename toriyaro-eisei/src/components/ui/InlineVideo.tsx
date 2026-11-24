import type { FC } from 'react';
import type { ScheduleVideo } from '../../types';

interface Props {
  video: ScheduleVideo;
  className?: string;
}

/**
 * 参考動画をその場に表示するプレイヤー（16:9、自動再生なし）。
 * upload は <video controls>、youtube/vimeo は iframe。
 */
export const InlineVideo: FC<Props> = ({ video, className = '' }) => (
  <div className={className}>
    {video.title && <p className="mb-1 text-[11px] font-bold text-text-muted">{video.title}</p>}
    <div className="w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
      {video.type === 'upload' ? (
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
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  </div>
);
