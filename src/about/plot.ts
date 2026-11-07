import type { About } from "./resolve";
import type { Words } from "./words";

export { grouped } from "./resolve";

export const ink = "#111";
export const mute = "#666";
export const hair = "#ccc";
export const faint = "#ececec";
export const soft = "#9a9a9a";
export const ramp = ["#163d6e", "#3f6fae", "#84a3cf", "#c4d3e8"];
export const size = 14;
export const small = 13;
export const row = 20;
export const page = 706;

export type Props = { about: About; words: Words; print?: boolean };

export const scale =
	([d0, d1]: number[], [r0, r1]: number[]) =>
	(x: number) =>
		r0 + ((x - d0) / (d1 - d0 || 1)) * (r1 - r0);

export const logScale = ([d0, d1]: number[], range: number[]) => {
	const s = scale([Math.log(d0), Math.log(d1)], range);
	return (x: number) => s(Math.log(x));
};

export const ticks = (lo: number, hi: number, count = 5) => {
	const raw = (hi - lo) / count;
	const power = 10 ** Math.floor(Math.log10(raw || 1));
	const step = ([1, 2, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
	const out: number[] = [];
	const first = Math.floor(lo / step + 1e-9);
	const last = Math.ceil(hi / step - 1e-9);
	for (let k = first; k <= last; k++) out.push(+(k * step).toPrecision(12));
	return out;
};

export const logTicks = (lo: number, hi: number) => {
	const steps = Math.log10(hi / lo) <= 2.5 ? [1, 2, 5] : [1];
	const out: number[] = [];
	for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
		for (const m of steps) {
			const t = +(m * 10 ** e).toPrecision(6);
			if (t >= lo * 0.999 && t <= hi * 1.001) out.push(t);
		}
	return out;
};

export const logSpan = (values: number[]) => {
	const edge = (x: number, up: boolean) => {
		const e = Math.floor(Math.log10(x));
		const steps = [1, 2, 5, 10].map((m) => m * 10 ** e);
		return up
			? (steps.find((t) => t >= x * 0.999) ?? 10 ** (e + 1))
			: ([...steps].reverse().find((t) => t <= x * 1.001) ?? 10 ** e);
	};
	return [edge(Math.min(...values), false), edge(Math.max(...values), true)];
};

export const decimals = (step: number) =>
	Math.max(0, -Math.floor(Math.log10(step) + 1e-9));

export const pct = (x: number, digits = 0) => `${(100 * x).toFixed(digits)}%`;

export const short = (x: number) => {
	if (x >= 1e6) return `${+(x / 1e6).toFixed(1)}M`;
	if (x >= 1e3) return `${+(x / 1e3).toFixed(1)}k`;
	return `${+(x < 1 ? x.toPrecision(2) : x.toFixed(2))}`;
};

const glyphs: Record<string, number> = {
	" ": 250,
	"!": 333,
	'"': 408,
	"#": 500,
	$: 500,
	"%": 833,
	"&": 778,
	"'": 333,
	"(": 333,
	")": 333,
	"*": 500,
	"+": 564,
	",": 250,
	"-": 333,
	".": 250,
	"/": 278,
	":": 278,
	";": 278,
	"<": 564,
	"=": 564,
	">": 564,
	"?": 444,
	"@": 921,
	A: 722,
	B: 667,
	C: 667,
	D: 722,
	E: 611,
	F: 556,
	G: 722,
	H: 722,
	I: 333,
	J: 389,
	K: 722,
	L: 611,
	M: 889,
	N: 722,
	O: 722,
	P: 556,
	Q: 722,
	R: 667,
	S: 556,
	T: 611,
	U: 722,
	V: 722,
	W: 944,
	X: 722,
	Y: 722,
	Z: 611,
	"[": 333,
	"]": 333,
	_: 500,
	a: 444,
	b: 500,
	c: 444,
	d: 500,
	e: 444,
	f: 333,
	g: 500,
	h: 500,
	i: 278,
	j: 278,
	k: 500,
	l: 278,
	m: 778,
	n: 500,
	o: 500,
	p: 500,
	q: 500,
	r: 333,
	s: 389,
	t: 278,
	u: 500,
	v: 500,
	w: 722,
	x: 500,
	y: 500,
	z: 444,
	"–": 500,
	"—": 1000,
	"…": 1000,
	"’": 333,
	"²": 300,
	"·": 250,
};

const cjk = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/;

const em = (c: string) => {
	if (c in glyphs) return glyphs[c] / 1000;
	if (cjk.test(c)) return 1;
	if (/[0-9]/.test(c)) return 0.5;
	if (/\p{Lu}/u.test(c)) return 0.72;
	return 0.5;
};

let canvas: CanvasRenderingContext2D | null | undefined;

export const measure = (text: string, px = size) => {
	if (typeof document === "undefined")
		return [...text].reduce((sum, c) => sum + em(c), 0) * px;
	canvas ??= document.createElement("canvas").getContext("2d");
	if (!canvas) return 0;
	canvas.font = `${px}px ${getComputedStyle(document.body).fontFamily}`;
	return canvas.measureText(text).width;
};

export const room = (names: string[], cap: number, px = size) =>
	Math.min(
		cap,
		Math.ceil(Math.max(0, ...names.map((n) => measure(n, px)))) + 8,
	);

const han = "\\u2e80-\\u2fff\\u3040-\\u9fff\\uf900-\\ufaff";
const mark = "\\u3000-\\u303f\\uff00-\\uffef";
const breaks = new RegExp(
	`[${han}]+[${mark}]*|[^\\s${han}${mark}]+[${mark}]*\\s*|[${mark}]+|\\s+`,
	"g",
);

export const pieces = (text: string) => text.match(breaks) ?? [];

export const wrap = (text: string, width: number, px = size) => {
	const lines: string[] = [];
	let at = "";
	for (const piece of pieces(text))
		for (const part of cjk.test(piece) && measure(piece, px) > width
			? [...piece]
			: [piece]) {
			const next = at + part;
			if (at.trim() && measure(next.trimEnd(), px) > width) {
				lines.push(at.trimEnd());
				at = part.trimStart();
			} else at = next;
		}
	if (at.trim()) lines.push(at.trimEnd());
	return lines;
};

export const fit = (text: string, width: number, px = size) => {
	if (measure(text, px) <= width) return text;
	let out = text;
	while (out.length > 1 && measure(`${out}…`, px) > width)
		out = out.slice(0, -1);
	return `${out.trimEnd()}…`;
};

export const named = (about: About, view: string) =>
	view === "all" ? "All" : (about.names.fields[view.split("/")[1]] ?? view);

export const order = (about: About, views: string[]) =>
	[...views].sort((a, b) =>
		a === "all"
			? -1
			: b === "all"
				? 1
				: named(about, a).localeCompare(named(about, b), "en"),
	);

export const land = (words: Words, code: string) => {
	if (code === "") return words.blank;
	if (code === "other") return words.other;
	try {
		return (
			new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code) ?? code
		);
	} catch {
		return code;
	}
};

export const near = <T>(items: T[], key: (item: T) => number, at: number) => {
	let best: T | undefined;
	let gap = Number.POSITIVE_INFINITY;
	for (const item of items) {
		const d = Math.abs(key(item) - at);
		if (d < gap) {
			gap = d;
			best = item;
		}
	}
	return best;
};

export const pointer = (event: PointerEvent) => {
	const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
	return [event.clientX - box.left, event.clientY - box.top];
};

export const path = (points: number[][]) =>
	points
		.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
		.join("");
