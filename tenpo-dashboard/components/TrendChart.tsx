"use client";

import { useState } from "react";
import { fmtMD } from "@/lib/format";

type Point = { date: string; value: number | null };

const W = 620;
const H = 260;
const PAD_L = 52;
const PAD_R = 20;
const PAD_T = 36;
const PAD_B = 30;

export default function TrendChart({
	points,
	unit = "",
	digits = 1,
	target = null,
	targetLabel = "目標",
}: {
	points: Point[];
	unit?: string;
	digits?: number;
	target?: number | null;
	targetLabel?: string;
}) {
	const [active, setActive] = useState<number | null>(null);

	const valid = points.filter((p): p is { date: string; value: number } => p.value !== null);
	if (valid.length === 0) {
		return <p className="muted">データがまだありません。</p>;
	}

	const values = valid.map((p) => p.value).concat(target !== null ? [target] : []);
	let min = Math.min(...values);
	let max = Math.max(...values);
	const span = max - min || Math.abs(max) * 0.1 || 1;
	min -= span * 0.15;
	max += span * 0.15;

	const plotW = W - PAD_L - PAD_R;
	const plotH = H - PAD_T - PAD_B;
	const x = (i: number) =>
		PAD_L + (points.length === 1 ? plotW / 2 : (i * plotW) / (points.length - 1));
	const y = (v: number) => PAD_T + ((max - v) / (max - min)) * plotH;

	const ticks = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);
	const segs = points
		.map((p, i) => (p.value === null ? null : `${x(i)},${y(p.value)}`))
		.filter((s): s is string => s !== null);
	const path = segs.map((seg, i) => `${i === 0 ? "M" : "L"}${seg}`).join(" ");
	const lastIdx = points.reduce((acc, p, i) => (p.value !== null ? i : acc), 0);
	const last = points[lastIdx];
	const lastY = last.value !== null ? y(last.value) : PAD_T;
	const calloutW = 64;
	const calloutX = Math.min(x(lastIdx) - calloutW / 2, W - PAD_R - calloutW);
	const calloutY = Math.max(lastY - 40, 4);
	const colW = points.length > 1 ? plotW / (points.length - 1) : plotW;
	// ラベルが混み合うときは間引く(最後の点は必ず表示)
	const labelStep = Math.max(1, Math.ceil(points.length / 8));
	const showLabel = (i: number) =>
		i === points.length - 1 || (points.length - 1 - i) % labelStep === 0;

	return (
		<div className="chart-wrap" onMouseLeave={() => setActive(null)}>
			<svg
				viewBox={`0 0 ${W} ${H}`}
				style={{ width: "100%", height: "auto", display: "block" }}
				role="img"
				aria-label={`推移。最新は${last.value?.toFixed(digits)}${unit}。`}
			>
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
							{t.toFixed(digits)}
						</text>
					</g>
				))}
				{points.map(
					(p, i) =>
						showLabel(i) && (
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

				{target !== null && (
					<g>
						<line
							x1={PAD_L}
							x2={W - PAD_R}
							y1={y(target)}
							y2={y(target)}
							stroke="#a1a1a6"
							strokeWidth={1.5}
							strokeDasharray="5 4"
						/>
						<text x={W - PAD_R} y={y(target) - 6} textAnchor="end" fontSize={10} fill="#6e6e73">
							{targetLabel} {target.toFixed(digits)}
							{unit}
						</text>
					</g>
				)}

				<path d={path} fill="none" stroke="#16436d" strokeWidth={2.5} strokeLinejoin="round" />
				{points.map(
					(p, i) =>
						p.value !== null && (
							<circle
								key={p.date}
								cx={x(i)}
								cy={y(p.value)}
								r={active === i ? 6 : 4.5}
								fill="#16436d"
								stroke="#fff"
								strokeWidth={2}
							/>
						),
				)}

				{last.value !== null && (
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
							fontSize={13}
							fontWeight={700}
							fill="#1d1d1f"
						>
							{last.value.toFixed(digits)}
							{unit}
						</text>
					</g>
				)}

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
			{active !== null && points[active].value !== null && (
				<div
					className="chart-tooltip"
					style={{
						left: `${(x(active) / W) * 100}%`,
						top: `${(y(points[active].value!) / H) * 100}%`,
					}}
				>
					{fmtMD(points[active].date)} — {points[active].value!.toFixed(digits)}
					{unit}
				</div>
			)}
		</div>
	);
}
