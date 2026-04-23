import React from 'react';
import { Dimensions } from 'react-native';
import Svg, { Defs, Mask, Rect, Ellipse } from 'react-native-svg';

type Props = {
  status: 'scanning' | 'analyzing' | 'ok' | 'warn';
};

const COLORS: Record<Props['status'], string> = {
  scanning: '#22d3ee',
  analyzing: '#facc15',
  ok: '#22c55e',
  warn: '#ef4444',
};

export function FaceFrame({ status }: Props) {
  const { width, height } = Dimensions.get('window');
  const cx = width / 2;
  const cy = height / 2 - 40;
  const rx = width * 0.35;
  const ry = rx * 1.3;
  const stroke = COLORS[status];

  return (
    <Svg
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <Mask id="faceMask">
          <Rect x={0} y={0} width={width} height={height} fill="white" />
          <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
        </Mask>
      </Defs>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="rgba(0,0,0,0.55)"
        mask="url(#faceMask)"
      />
      <Ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        stroke={stroke}
        strokeWidth={4}
        fill="transparent"
      />
    </Svg>
  );
}
