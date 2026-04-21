import Svg, { Rect } from 'react-native-svg';
import type { FaceBox } from '@/types/agey';

type Props = {
  face: FaceBox | null;
  containerWidth: number;
  containerHeight: number;
  frameWidth: number;
  frameHeight: number;
  color: string;
};

/**
 * 顔検出結果の矩形をカメラプレビューに重ねる。
 * frame 座標 (センサー解像度) を container 座標 (表示ピクセル) にマップする。
 */
export function FaceFrameOverlay({
  face,
  containerWidth,
  containerHeight,
  frameWidth,
  frameHeight,
  color,
}: Props) {
  if (!face || frameWidth === 0 || frameHeight === 0) return null;

  const scaleX = containerWidth / frameWidth;
  const scaleY = containerHeight / frameHeight;
  const x = face.x * scaleX;
  const y = face.y * scaleY;
  const w = face.width * scaleX;
  const h = face.height * scaleY;

  return (
    <Svg
      width={containerWidth}
      height={containerHeight}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={color}
        strokeWidth={4}
        fill="transparent"
        rx={12}
      />
    </Svg>
  );
}
