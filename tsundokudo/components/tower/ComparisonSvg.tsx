/**
 * ComparisonSvg – 比較オブジェクトの SVG シルエット (設計書 5-2)
 *
 * - 各オブジェクトの実寸 heightMm × PX_PER_MM ピクセルで描画
 * - 幅は固定 displayWidth に収まるよう viewBox で自動スケール
 * - 半透明シルエット + ラベルで表示
 */
import Svg, { Circle, Ellipse, Path, Rect, G } from 'react-native-svg';

import type { ComparisonObject } from '@/lib/towerUtils';
import { comparisonDisplayPx } from '@/lib/towerUtils';

type Props = {
  object: ComparisonObject;
  /** 表示幅 (px) */
  displayWidth: number;
};

export function ComparisonSvg({ object, displayWidth }: Props) {
  const displayHeight = comparisonDisplayPx(object);

  // viewBox: 自然サイズ (naturalWidthMm × heightMm) をそのまま使用
  // SVG が displayWidth × displayHeight に引き伸ばされる
  const vbW = object.naturalWidthMm;
  const vbH = object.heightMm;
  const c = object.color;

  return (
    <Svg
      width={displayWidth}
      height={displayHeight}
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMax meet"
    >
      {getShape(object.id, vbW, vbH, c)}
    </Svg>
  );
}

// ─── 各オブジェクトの SVG パス ────────────────────────────────

function getShape(id: string, w: number, h: number, color: string) {
  switch (id) {
    case 'hamster':
      return <HamsterShape w={w} h={h} color={color} />;
    case 'petbottle':
      return <PetBottleShape w={w} h={h} color={color} />;
    case 'cat':
      return <CatShape w={w} h={h} color={color} />;
    case 'child':
      return <PersonShape w={w} h={h} color={color} headRatio={0.14} />;
    case 'adult':
      return <PersonShape w={w} h={h} color={color} headRatio={0.12} />;
    case 'door':
      return <DoorShape w={w} h={h} color={color} />;
    case 'giraffe':
      return <GiraffeShape w={w} h={h} color={color} />;
    case 'building':
      return <BuildingShape w={w} h={h} color={color} />;
    default:
      return <GenericShape w={w} h={h} color={color} label={id} />;
  }
}

// ─── ハムスター ───────────────────────────────────────────────
function HamsterShape({ w, h, color }: { w: number; h: number; color: string }) {
  const cx = w / 2;
  // 体（大きな楕円）
  const bodyRx = w * 0.38;
  const bodyRy = h * 0.38;
  const bodyCy = h * 0.6;
  // 頭
  const headR = w * 0.22;
  const headCy = h * 0.22;
  // 耳
  const earR = w * 0.1;
  return (
    <G opacity={0.85}>
      {/* 体 */}
      <Ellipse cx={cx} cy={bodyCy} rx={bodyRx} ry={bodyRy} fill={color} />
      {/* 頭 */}
      <Circle cx={cx} cy={headCy} r={headR} fill={color} />
      {/* 左耳 */}
      <Circle cx={cx - headR * 0.7} cy={headCy - headR * 0.9} r={earR} fill={color} />
      {/* 右耳 */}
      <Circle cx={cx + headR * 0.7} cy={headCy - headR * 0.9} r={earR} fill={color} />
      {/* しっぽ */}
      <Circle cx={cx + bodyRx * 0.9} cy={bodyCy} r={w * 0.05} fill={color} />
    </G>
  );
}

// ─── ペットボトル ─────────────────────────────────────────────
function PetBottleShape({ w, h, color }: { w: number; h: number; color: string }) {
  const cx = w / 2;
  // キャップ
  const capW = w * 0.3;
  const capH = h * 0.07;
  // ネック（くびれ）
  const neckW = w * 0.22;
  const neckH = h * 0.12;
  // 本体
  const bodyW = w * 0.8;
  const bodyH = h * 0.72;
  const bodyY = h * 0.21;
  // 底
  const bottomH = h * 0.07;

  return (
    <G opacity={0.82}>
      {/* キャップ */}
      <Rect
        x={cx - capW / 2}
        y={0}
        width={capW}
        height={capH}
        rx={capW * 0.2}
        fill={color}
      />
      {/* ネック */}
      <Rect
        x={cx - neckW / 2}
        y={capH}
        width={neckW}
        height={neckH}
        fill={color}
      />
      {/* 肩（台形）*/}
      <Path
        d={`M${cx - neckW / 2},${capH + neckH} L${cx - bodyW / 2},${bodyY} L${cx + bodyW / 2},${bodyY} L${cx + neckW / 2},${capH + neckH} Z`}
        fill={color}
      />
      {/* 本体 */}
      <Rect
        x={cx - bodyW / 2}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={w * 0.06}
        fill={color}
      />
      {/* 底 */}
      <Ellipse
        cx={cx}
        cy={bodyY + bodyH + bottomH / 2}
        rx={bodyW / 2}
        ry={bottomH}
        fill={color}
      />
    </G>
  );
}

// ─── 猫（直立） ───────────────────────────────────────────────
function CatShape({ w, h, color }: { w: number; h: number; color: string }) {
  const cx = w / 2;
  const headR = w * 0.16;
  const headCy = h * 0.15;
  // 耳（三角形）
  const earH = h * 0.06;
  const earW = w * 0.08;
  // 体
  const bodyW = w * 0.35;
  const bodyH = h * 0.38;
  const bodyY = headCy + headR + h * 0.01;
  // 脚
  const legW = bodyW * 0.3;
  const legH = h * 0.3;
  const legY = bodyY + bodyH - legH * 0.1;
  // しっぽ（曲線）
  const tailX = cx + bodyW / 2;
  const tailY = bodyY + bodyH * 0.6;

  return (
    <G opacity={0.85}>
      {/* 左耳 */}
      <Path
        d={`M${cx - headR * 0.5},${headCy - headR * 0.8} L${cx - headR * 0.5 - earW},${headCy - headR * 0.8 - earH} L${cx - headR * 0.5 + earW * 0.3},${headCy - headR * 0.8} Z`}
        fill={color}
      />
      {/* 右耳 */}
      <Path
        d={`M${cx + headR * 0.5},${headCy - headR * 0.8} L${cx + headR * 0.5 + earW},${headCy - headR * 0.8 - earH} L${cx + headR * 0.5 - earW * 0.3},${headCy - headR * 0.8} Z`}
        fill={color}
      />
      {/* 頭 */}
      <Circle cx={cx} cy={headCy} r={headR} fill={color} />
      {/* 体 */}
      <Rect
        x={cx - bodyW / 2}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={bodyW * 0.3}
        fill={color}
      />
      {/* 左後ろ脚 */}
      <Rect
        x={cx - bodyW / 2 + legW * 0.2}
        y={legY}
        width={legW}
        height={legH}
        rx={legW * 0.4}
        fill={color}
      />
      {/* 右後ろ脚 */}
      <Rect
        x={cx + bodyW / 2 - legW * 1.2}
        y={legY}
        width={legW}
        height={legH}
        rx={legW * 0.4}
        fill={color}
      />
      {/* しっぽ（曲線パス） */}
      <Path
        d={`M${tailX},${tailY} Q${tailX + w * 0.25},${tailY + h * 0.15} ${tailX + w * 0.1},${tailY + h * 0.32}`}
        stroke={color}
        strokeWidth={w * 0.06}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

// ─── 人物シルエット（子供・大人共通） ─────────────────────────
function PersonShape({
  w,
  h,
  color,
  headRatio,
}: {
  w: number;
  h: number;
  color: string;
  headRatio: number;
}) {
  const cx = w / 2;
  const headR = h * headRatio * 0.5;
  const headCy = headR * 1.05;
  // 胴体
  const shoulderY = headCy + headR;
  const bodyW = w * 0.32;
  const bodyH = h * 0.37;
  // 腕
  const armW = w * 0.1;
  const armH = h * 0.3;
  // 脚
  const legW = bodyW * 0.38;
  const legH = h * 0.36;
  const legY = shoulderY + bodyH;

  return (
    <G opacity={0.85}>
      {/* 頭 */}
      <Circle cx={cx} cy={headCy} r={headR} fill={color} />
      {/* 胴体 */}
      <Rect
        x={cx - bodyW / 2}
        y={shoulderY}
        width={bodyW}
        height={bodyH}
        rx={bodyW * 0.2}
        fill={color}
      />
      {/* 左腕 */}
      <Rect
        x={cx - bodyW / 2 - armW}
        y={shoulderY + h * 0.02}
        width={armW}
        height={armH}
        rx={armW * 0.5}
        fill={color}
      />
      {/* 右腕 */}
      <Rect
        x={cx + bodyW / 2}
        y={shoulderY + h * 0.02}
        width={armW}
        height={armH}
        rx={armW * 0.5}
        fill={color}
      />
      {/* 左脚 */}
      <Rect
        x={cx - bodyW / 2 + legW * 0.15}
        y={legY}
        width={legW}
        height={legH}
        rx={legW * 0.35}
        fill={color}
      />
      {/* 右脚 */}
      <Rect
        x={cx + bodyW / 2 - legW * 1.15}
        y={legY}
        width={legW}
        height={legH}
        rx={legW * 0.35}
        fill={color}
      />
    </G>
  );
}

// ─── 玄関ドア ─────────────────────────────────────────────────
function DoorShape({ w, h, color }: { w: number; h: number; color: string }) {
  const stroke = color;
  const fill = `${color}55`; // 半透明
  const panelInset = w * 0.1;
  const mid = h * 0.55;
  return (
    <G opacity={0.85}>
      {/* ドア枠 */}
      <Rect x={0} y={0} width={w} height={h} rx={w * 0.03} fill={fill} stroke={stroke} strokeWidth={w * 0.04} />
      {/* 上パネル */}
      <Rect
        x={panelInset}
        y={panelInset}
        width={w - panelInset * 2}
        height={mid - panelInset * 2}
        rx={w * 0.02}
        fill={`${color}33`}
        stroke={stroke}
        strokeWidth={w * 0.025}
      />
      {/* 下パネル */}
      <Rect
        x={panelInset}
        y={mid + panelInset}
        width={w - panelInset * 2}
        height={h - mid - panelInset * 2}
        rx={w * 0.02}
        fill={`${color}33`}
        stroke={stroke}
        strokeWidth={w * 0.025}
      />
      {/* ドアノブ */}
      <Circle cx={w * 0.75} cy={h * 0.55} r={w * 0.05} fill={stroke} />
    </G>
  );
}

// ─── キリン ───────────────────────────────────────────────────
function GiraffeShape({ w, h, color }: { w: number; h: number; color: string }) {
  const cx = w * 0.45;
  // 脚
  const legW = w * 0.08;
  const legH = h * 0.38;
  const legY = h * 0.62;
  // 体
  const bodyW = w * 0.55;
  const bodyH = h * 0.22;
  const bodyX = cx - bodyW * 0.5;
  const bodyY = h * 0.42;
  // 首
  const neckW = w * 0.14;
  const neckH = h * 0.35;
  const neckX = cx - w * 0.18;
  const neckY = bodyY - neckH + bodyH * 0.3;
  // 頭
  const headW = w * 0.22;
  const headH = h * 0.09;
  const headX = neckX - headW * 0.3;
  const headY = neckY - headH * 0.7;
  // 角（オシコン）
  const hornH = h * 0.04;

  return (
    <G opacity={0.85}>
      {/* 前左脚 */}
      <Rect x={cx - bodyW * 0.35} y={legY} width={legW} height={legH} rx={legW * 0.4} fill={color} />
      {/* 前右脚 */}
      <Rect x={cx - bodyW * 0.1} y={legY} width={legW} height={legH} rx={legW * 0.4} fill={color} />
      {/* 後左脚 */}
      <Rect x={cx + bodyW * 0.15} y={legY} width={legW} height={legH} rx={legW * 0.4} fill={color} />
      {/* 後右脚 */}
      <Rect x={cx + bodyW * 0.38} y={legY + legH * 0.05} width={legW} height={legH * 0.95} rx={legW * 0.4} fill={color} />
      {/* 体 */}
      <Ellipse cx={cx + bodyW * 0.05} cy={bodyY + bodyH / 2} rx={bodyW / 2} ry={bodyH / 2} fill={color} />
      {/* 首 */}
      <Path
        d={`M${neckX},${bodyY + bodyH * 0.2} L${neckX},${neckY + neckH} L${neckX + neckW},${neckY + neckH} L${neckX + neckW * 1.3},${bodyY + bodyH * 0.1} Z`}
        fill={color}
      />
      {/* 頭 */}
      <Ellipse cx={headX + headW / 2} cy={headY + headH / 2} rx={headW / 2} ry={headH / 2} fill={color} />
      {/* 角 */}
      <Rect x={headX + headW * 0.25} y={headY - hornH} width={w * 0.025} height={hornH} rx={w * 0.01} fill={color} />
      <Rect x={headX + headW * 0.55} y={headY - hornH * 0.7} width={w * 0.025} height={hornH * 0.7} rx={w * 0.01} fill={color} />
      {/* しっぽ */}
      <Path
        d={`M${cx + bodyW * 0.48},${bodyY + bodyH * 0.5} Q${cx + bodyW * 0.62},${bodyY + bodyH * 0.8} ${cx + bodyW * 0.5},${bodyY + bodyH * 1.1}`}
        stroke={color}
        strokeWidth={w * 0.03}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

// ─── ビル ─────────────────────────────────────────────────────
function BuildingShape({ w, h, color }: { w: number; h: number; color: string }) {
  const floors = 10;
  const floorH = h / floors;
  const windowW = w * 0.12;
  const windowH = floorH * 0.45;
  const cols = 4;

  return (
    <G opacity={0.85}>
      {/* 本体 */}
      <Rect x={0} y={0} width={w} height={h} rx={w * 0.02} fill={`${color}55`} />
      {/* 各フロアの窓 */}
      {Array.from({ length: floors }).map((_, floor) => (
        <G key={floor}>
          {Array.from({ length: cols }).map((__, col) => (
            <Rect
              key={col}
              x={w * 0.08 + col * (w * 0.22)}
              y={floor * floorH + floorH * 0.25}
              width={windowW}
              height={windowH}
              rx={windowW * 0.2}
              fill={floor % 3 === 0 ? `${color}CC` : `${color}66`}
            />
          ))}
          {/* フロア区切り線 */}
          <Rect x={0} y={(floor + 1) * floorH} width={w} height={1} fill={`${color}55`} />
        </G>
      ))}
      {/* 屋上アンテナ */}
      <Rect x={w * 0.46} y={-h * 0.06} width={w * 0.08} height={h * 0.06} fill={color} />
    </G>
  );
}

// ─── フォールバック ────────────────────────────────────────────
function GenericShape({
  w,
  h,
  color,
  label,
}: {
  w: number;
  h: number;
  color: string;
  label: string;
}) {
  return (
    <G opacity={0.8}>
      <Rect x={w * 0.1} y={0} width={w * 0.8} height={h} rx={w * 0.1} fill={color} />
    </G>
  );
}
