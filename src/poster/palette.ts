import { continents } from "../continents";

export const ink = "#111111";
export const grey = "#5b616b";
export const quiet = "#8a919c";
export const soft = "#41464e";
export const rule = "#c9ced6";
export const grid = "#e7eaee";
export const paper = "#ffffff";
export const link = "#1a4f8b";
export const tiers = ["#163d6e", "#3f6fae", "#84a3cf", "#c4d3e8"];
export const tierText = ["#ffffff", "#ffffff", ink, ink];

const linear = (c: number) =>
	c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

export const oklch = (l: number, c: number, h: number) => {
	const a = c * Math.cos((h * Math.PI) / 180);
	const b = c * Math.sin((h * Math.PI) / 180);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const rgb = [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
	];
	return `#${rgb
		.map((v) =>
			Math.round(255 * Math.min(1, Math.max(0, linear(v))))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
};

const channel = (v: number) => {
	const c = v / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const luminance = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((k) =>
		channel(Number.parseInt(hex.slice(k, k + 2), 16)),
	);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
	const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};

export const textOn = (hex: string) =>
	contrast(hex, ink) >= contrast(hex, paper) ? ink : paper;

const below = 32;
const above = 252;
const steps = [
	[0.935, 0.03],
	[0.875, 0.06],
	[0.8, 0.095],
	[0.72, 0.13],
] as const;

export const classes = [
	...[...steps].reverse().map(([l, c]) => oklch(l, c, below)),
	...steps.map(([l, c]) => oklch(l, c, above)),
];

export const classBounds = ["1/8", "1/4", "1/2", "1", "2", "4", "8"];

export const classOf = (count: number, expected: number) => {
	if (expected <= 0) return classes.length - 1;
	const k = Math.floor(Math.log2(count / expected));
	return Math.min(classes.length - 1, Math.max(0, k + 4));
};

type Family = {
	hues: [number, number];
	light: [number, number];
	chroma: number;
};

const families: Record<string, Family> = {
	Asia: { hues: [8, 78], light: [0.46, 0.86], chroma: 0.17 },
	Europe: { hues: [128, 192], light: [0.42, 0.86], chroma: 0.12 },
	"North America": { hues: [234, 272], light: [0.44, 0.84], chroma: 0.15 },
	Oceania: { hues: [288, 330], light: [0.5, 0.82], chroma: 0.14 },
	"South America": { hues: [98, 122], light: [0.6, 0.88], chroma: 0.15 },
	Africa: { hues: [40, 70], light: [0.4, 0.74], chroma: 0.06 },
	Antarctica: { hues: [220, 220], light: [0.6, 0.8], chroma: 0.02 },
};

const spread: [number, number][] = [
	[0.1, 0.42],
	[0.62, 0.5],
	[0.95, 0.78],
	[0.38, 0.12],
	[0.0, 0.84],
	[0.8, 0.2],
	[0.5, 0.95],
	[0.22, 0.65],
	[0.72, 0.68],
	[1.0, 0.3],
	[0.3, 0.88],
	[0.88, 0.04],
	[0.05, 0.08],
	[0.55, 0.3],
	[0.15, 0.98],
	[0.45, 0.58],
];

export const familyOrder = [
	"North America",
	"Europe",
	"Asia",
	"Oceania",
	"South America",
	"Africa",
	"Antarctica",
];

export const continentOf = new Map<string, string>(
	continents.flatMap(([name, codes]) =>
		codes.split(" ").map((code) => [code, name] as [string, string]),
	),
);

export const familyTone = (continent: string) => {
	const f = families[continent];
	if (!f) return nobody;
	return oklch(
		(f.light[0] + f.light[1]) / 2,
		f.chroma,
		(f.hues[0] + f.hues[1]) / 2,
	);
};

export const painter = (order: string[]) => {
	const seen = new Map<string, number>();
	const index = new Map<string, number>();
	for (const code of order) {
		const c = continentOf.get(code) ?? "";
		const k = seen.get(c) ?? 0;
		index.set(code, k);
		seen.set(c, k + 1);
	}
	const cache = new Map<string, string>();
	return (code: string) => {
		if (!code) return nobody;
		const hit = cache.get(code);
		if (hit) return hit;
		const f = families[continentOf.get(code) ?? ""];
		let out = nobody;
		if (f) {
			const [hf, lf] = spread[(index.get(code) ?? 0) % spread.length];
			const l = f.light[0] + lf * (f.light[1] - f.light[0]);
			const c = f.chroma * (1 - (0.45 * Math.max(0, l - 0.7)) / 0.3);
			out = oklch(l, c, f.hues[0] + hf * (f.hues[1] - f.hues[0]));
		}
		cache.set(code, out);
		return out;
	};
};

export const nobody = oklch(0.76, 0, 0);

export const gain = oklch(0.52, 0.14, 252);
export const loss = oklch(0.58, 0.17, 32);
export const par = oklch(0.74, 0.012, 255);
