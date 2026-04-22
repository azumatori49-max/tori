import { Text, View } from 'react-native';
import Svg, { Ellipse, Rect } from 'react-native-svg';
import type { SamplingHint } from '@/types/agey';
import type { FaceBox } from '@/types/agey';

type Props = {
  face: FaceBox | null;
  containerWidth: number;
  containerHeight: number;
  frameWidth: number;
  frameHeight: number;
  color: string;
  samplingHint: SamplingHint;
};

const HINT_TEXT: Record<NonNullable<SamplingHint>, string> = {
  tooFar:     '近づいてください',
  tooClose:   '離れてください',
  misaligned: '正面を向いてください',
};

export function FaceFrameOverlay({
  face,
  containerWidth,
  containerHeight,
  frameWidth,
  frameHeight,
  color,
  samplingHint,
}: Props) {
  if (containerWidth === 0 || containerHeight === 0) return null;

  const cx = containerWidth / 2;
  const cy = containerHeight / 2;
  const rx = containerWidth * 0.30;   // ~96 px on 320-wide view
  const ry = containerHeight * 0.36;  // ~151 px on 420-tall view

  const noFace = !face;
  const guideOpacity = noFace ? 0.35 : 1;
  const strokeDash = noFace ? '10 8' : undefined;

  let faceBounds: { x: number; y: number; w: number; h: number } | null = null;
  if (face && frameWidth > 0 && frameHeight > 0) {
    const sx = containerWidth / frameWidth;
    const sy = containerHeight / frameHeight;
    faceBounds = {
      x: face.x * sx,
      y: face.y * sy,
      w: face.width * sx,
      h: face.height * sy,
    };
  }

  const hintLabel = samplingHint ? HINT_TEXT[samplingHint] : noFace ? '顔をここに合わせてください' : null;

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, width: containerWidth, height: containerHeight }}
      pointerEvents="none"
    >
      <Svg width={containerWidth} height={containerHeight}>
        {/* Always-visible face guide oval */}
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={color}
          strokeWidth={3}
          strokeOpacity={guideOpacity}
          strokeDasharray={strokeDash}
          fill="transparent"
        />

        {/* Face bounding box when detected */}
        {faceBounds && (
          <Rect
            x={faceBounds.x}
            y={faceBounds.y}
            width={faceBounds.w}
            height={faceBounds.h}
            stroke={color}
            strokeWidth={2}
            strokeOpacity={0.5}
            fill="transparent"
            rx={8}
          />
        )}
      </Svg>

      {/* Hint text centered in the oval */}
      {hintLabel && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: cy + ry + 10,
            alignItems: 'center',
          }}
        >
          <View style={{ backgroundColor: '#00000099', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: color, fontSize: 14, fontWeight: '600' }}>{hintLabel}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
