"use client";

import { cn } from "@/lib/utils";
import type { ChartPoint } from "@/lib/types";

const palette = [
	"#2563eb",
	"#0891b2",
	"#16a34a",
	"#f59e0b",
	"#e11d48",
	"#7c3aed",
	"#0f766e",
	"#ea580c",
];

function valueOf(point: ChartPoint) {
	return Number(point.value ?? point.count ?? 0);
}

function labelOf(point: ChartPoint, index: number) {
	return String(point.name ?? point.date ?? `Mục ${index + 1}`);
}

export function Sparkline({ data, className }: { data: ChartPoint[]; className?: string }) {
	const values = data.map(valueOf);
	const max = Math.max(...values, 1);
	const min = Math.min(...values, 0);
	const points = values
		.map((value, index) => {
			const x = values.length <= 1 ? 100 : (index / (values.length - 1)) * 100;
			const y = 32 - ((value - min) / Math.max(max - min, 1)) * 26;
			return `${x},${y}`;
		})
		.join(" ");
	return (
		<svg viewBox="0 0 100 36" className={cn("h-9 w-24", className)}>
			<polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
		</svg>
	);
}

export function LineAreaChart({
	data,
	area = false,
	color = "#2563eb",
}: {
	data: ChartPoint[];
	area?: boolean;
	color?: string;
}) {
	const values = data.map(valueOf);
	const max = Math.max(...values, 1);
	const min = Math.min(...values, 0);
	const points = values
		.map((value, index) => {
			const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 320;
			const y = 150 - ((value - min) / Math.max(max - min, 1)) * 120;
			return `${x},${y}`;
		})
		.join(" ");
	const areaPoints = `0,160 ${points} 320,160`;
	return (
		<div className="h-64 w-full">
			<svg viewBox="0 0 320 180" className="h-full w-full overflow-visible">
				<defs>
					<linearGradient id={`area-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
						<stop offset="0%" stopColor={color} stopOpacity="0.24" />
						<stop offset="100%" stopColor={color} stopOpacity="0.02" />
					</linearGradient>
				</defs>
				{[30, 70, 110, 150].map((y) => (
					<line key={y} x1="0" x2="320" y1={y} y2={y} stroke="currentColor" opacity="0.08" />
				))}
				{area ? <polygon points={areaPoints} fill={`url(#area-${color.replace("#", "")})`} /> : null}
				<polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-in fade-in duration-500" />
				{data.map((point, index) => {
					const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * 320;
					const y = 150 - ((valueOf(point) - min) / Math.max(max - min, 1)) * 120;
					return (
						<circle key={`${labelOf(point, index)}-${index}`} cx={x} cy={y} r="3.5" fill="white" stroke={color} strokeWidth="2">
							<title>{`${labelOf(point, index)}: ${valueOf(point)}`}</title>
						</circle>
					);
				})}
			</svg>
		</div>
	);
}

export function BarChart({
	data,
	stacked,
}: {
	data: ChartPoint[];
	stacked?: boolean;
}) {
	const max = Math.max(...data.map(valueOf), 1);
	if (stacked) {
		const total = Math.max(data.reduce((sum, point) => sum + valueOf(point), 0), 1);
		return (
			<div className="space-y-4">
				<div className="flex h-8 overflow-hidden rounded-lg bg-muted">
					{data.map((point, index) => (
						<div
							key={labelOf(point, index)}
							style={{ width: `${(valueOf(point) / total) * 100}%`, backgroundColor: palette[index % palette.length] }}
							className="transition-all duration-500"
							title={`${labelOf(point, index)}: ${valueOf(point)}`}
						/>
					))}
				</div>
				<div className="grid gap-2 sm:grid-cols-2">
					{data.map((point, index) => (
						<div key={labelOf(point, index)} className="flex items-center justify-between gap-3 text-sm">
							<span className="flex items-center gap-2 text-muted-foreground">
								<span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette[index % palette.length] }} />
								{labelOf(point, index)}
							</span>
							<span className="font-medium">{valueOf(point)}</span>
						</div>
					))}
				</div>
			</div>
		);
	}
	return (
		<div className="flex h-64 items-end gap-3">
			{data.map((point, index) => (
				<div key={`${labelOf(point, index)}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
					<div className="flex h-52 w-full items-end rounded-t-lg bg-muted/40">
						<div
							className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80"
							style={{
								height: `${Math.max(5, (valueOf(point) / max) * 100)}%`,
								backgroundColor: palette[index % palette.length],
							}}
							title={`${labelOf(point, index)}: ${valueOf(point)}`}
						/>
					</div>
					<span className="w-full truncate text-center text-xs text-muted-foreground">{labelOf(point, index).slice(5)}</span>
				</div>
			))}
		</div>
	);
}

export function HorizontalBarChart({ data }: { data: ChartPoint[] }) {
	const max = Math.max(...data.map(valueOf), 1);
	return (
		<div className="space-y-3">
			{data.map((point, index) => (
				<div key={`${labelOf(point, index)}-${index}`} className="space-y-1">
					<div className="flex justify-between gap-3 text-sm">
						<span className="line-clamp-1">{labelOf(point, index)}</span>
						<span className="font-medium">{valueOf(point)}</span>
					</div>
					<div className="h-2 rounded-full bg-muted">
						<div
							className="h-2 rounded-full transition-all duration-500"
							style={{ width: `${(valueOf(point) / max) * 100}%`, backgroundColor: palette[index % palette.length] }}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

export function DonutChart({
	data,
	size = 156,
}: {
	data: ChartPoint[];
	size?: number;
}) {
	const total = Math.max(data.reduce((sum, point) => sum + valueOf(point), 0), 1);
	let offset = 25;
	const radius = 48;
	const circumference = 2 * Math.PI * radius;
	return (
		<div className="flex flex-col items-center gap-4 sm:flex-row">
			<svg viewBox="0 0 120 120" style={{ width: size, height: size }} className="-rotate-90">
				<circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="14" opacity="0.08" />
				{data.map((point, index) => {
					const dash = (valueOf(point) / total) * circumference;
					const node = (
						<circle
							key={`${labelOf(point, index)}-${index}`}
							cx="60"
							cy="60"
							r={radius}
							fill="none"
							stroke={palette[index % palette.length]}
							strokeWidth="14"
							strokeDasharray={`${dash} ${circumference - dash}`}
							strokeDashoffset={-offset}
							strokeLinecap="round"
						>
							<title>{`${labelOf(point, index)}: ${valueOf(point)}`}</title>
						</circle>
					);
					offset += dash;
					return node;
				})}
			</svg>
			<div className="min-w-0 flex-1 space-y-2">
				{data.map((point, index) => (
					<div key={labelOf(point, index)} className="flex items-center justify-between gap-4 text-sm">
						<span className="flex min-w-0 items-center gap-2 text-muted-foreground">
							<span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
							<span className="truncate">{labelOf(point, index)}</span>
						</span>
						<span className="font-medium">{valueOf(point)}</span>
					</div>
				))}
			</div>
		</div>
	);
}

export function ProgressRing({
	value,
	label,
}: {
	value: number;
	label: string;
}) {
	const radius = 42;
	const circumference = 2 * Math.PI * radius;
	const dash = (Math.max(0, Math.min(value, 100)) / 100) * circumference;
	return (
		<div className="relative flex h-32 w-32 items-center justify-center">
			<svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
				<circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="12" opacity="0.1" />
				<circle
					cx="60"
					cy="60"
					r={radius}
					fill="none"
					stroke="hsl(var(--primary))"
					strokeWidth="12"
					strokeDasharray={`${dash} ${circumference - dash}`}
					strokeLinecap="round"
				/>
			</svg>
			<div className="absolute text-center">
				<p className="text-2xl font-semibold">{value}%</p>
				<p className="text-xs text-muted-foreground">{label}</p>
			</div>
		</div>
	);
}

export function Heatmap({ data }: { data: ChartPoint[] }) {
	const max = Math.max(...data.map(valueOf), 1);
	return (
		<div className="grid grid-cols-8 gap-1">
			{data.map((point, index) => {
				const value = valueOf(point);
				const opacity = value === 0 ? 0.08 : 0.18 + (value / max) * 0.72;
				return (
					<div
						key={index}
						className="aspect-square rounded-sm bg-primary transition hover:scale-110"
						style={{ opacity }}
						title={`${labelOf(point, index)}: ${value}`}
					/>
				);
			})}
		</div>
	);
}
