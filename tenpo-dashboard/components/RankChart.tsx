"use client";

import { useState } from "react";
import type { RankPoint } from "@/lib/types";
import { fmtMD } from "@/lib/format";

const W = 620;
const H = 280;
const PAD_L = 44;
const PAD_R = 20;
const PAD_T = 40;
const PAD_B = 30;

export default function RankChart({ points }: { points: RankPoint[] }) {
	const [active, setActive] = useState<number | null>(null);

	if (points.length === 0) {
		return <p className="muted">順位データがまだありません。</p>;
	}

	const maxRank = Math.max(40, ...points.map((p) => p.rank));
	const axisMax = Math.ceil(maxRank / 10) * 10;
	const plotW = W - PAD_L - PAD_R;
	const plotH = H - PAD_T - PAD_B;
	const x = (i: number) =>
		PAD_L + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
	const y = (rank: number) => PAD_T + ((rank - 1) / (axisMax - 1)) * plotH;

	const ticks = [1, ...Array.from({ length: axisMax / 10 }, (_, k) => (k + 1) * 10)];
	const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.rank)}`).join(" ");
	const last = points[points.length - 1];
	const lastX = x(points.length - 1);
	const lastY = y(last.rank);
	// 吹き出しがプロット外にはみ出さないように位置を調整
	const calloutW = 48;
	const calloutX = Math.min(lastX - calloutW / 2, W - PAD_R - calloutW);
	const calloutY = Math.max(lastY - 40, 4);
	const colW = points.length > 1 ? plotW / (points.length - 1) : plotW;

	return (
		<div className="chart-wrap" onMouseLeave={() => setActive(null)}>
			<svg
				viewBox={`0 0 ${W} ${H}`}
				style={{ width: "100%", height: "auto", display: "block" }}
				role="img"
				aria-label={`総合順位の推移。最新は${last.rank}位。`}
			>
				{/* グリッドと軸ラベル */}
				{ticks.map((t) => (
					<g key={t}>
						<line
							x1={PAD_L}
							x2={W - PAD_R}
							y1={y(t)}
							y2={y(t)}
							stroke="rgba(0,0,0,0.07)"
							strokeWidth={1}
						/>
						<text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#a1a1a6">
							{t}位
						</text>
					</g>
				))}
				{points.map(
					(p, i) =>
						// ラベルが混み合うときは間引く(最後の点は必ず表示)
						(i === points.length - 1 ||
							(points.length - 1 - i) % Math.max(1, Math.ceil(points.length / 8)) === 0) && (
							<text
								key={p.date}
								x={x(i)}
								y={H - 8}
								textAnchor="middle"
								fontSize={11}
								fill="#6e6e73"
							>
								{fmtMD(p.date)}
							</text>
						),
				)}

				{/* 折れ線とマーカー */}
				<path d={path} fill="none" stroke="#c25534" strokeWidth={2.5} strokeLinejoin="round" />
				{points.map((p, i) => (
					<circle
						key={p.date}
						cx={x(i)}
						cy={y(p.rank)}
						r={active === i ? 6 : 4.5}
						fill="#c25534"
						stroke="#fff"
						strokeWidth={2}
					/>
				))}

				{/* 最新順位の吹き出し */}
				<g>
					<rect
						x={calloutX}
						y={calloutY}
						width={calloutW}
						height={26}
						rx={7}
						fill="#fff"
						stroke="#1d1d1f"
						strokeWidth={1.5}
					/>
					<text
						x={calloutX + calloutW / 2}
						y={calloutY + 18}
						textAnchor="middle"
						fontSize={14}
						fontWeight={700}
						fill="#1d1d1f"
					>
						{last.rank}位
					</text>
				</g>

				{/* ホバー領域(マークより大きいヒットターゲット) */}
				{points.map((p, i) => (
					<rect
						key={p.date}
						x={x(i) - colW / 2}
						y={0}
						width={colW}
						height={H}
						fill="transparent"
						onMouseEnter={() => setActive(i)}
						onTouchStart={() => setActive(i)}
					/>
				))}
			</svg>
			{active !== null && (
				<div
					className="chart-tooltip"
					style={{
						left: `${(x(active) / W) * 100}%`,
						top: `${(y(points[active].rank) / H) * 100}%`,
					}}
				>
					{fmtMD(points[active].date)} — {points[active].rank}位
				</div>
			)}
		</div>
	);
}
