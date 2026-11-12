import { cap, type Font, measure, wrap } from "./fonts";
import {
	clean,
	decade,
	fixed,
	hundredths,
	papers,
	signed,
	snap,
	tick,
	whole,
} from "./format";
import type { Masthead } from "./masthead";
import type { Data, Derived, Institution } from "./model";
import {
	classes,
	gain,
	grey,
	grid,
	ink,
	loss,
	paper,
	par,
	quiet,
	rule,
} from "./palette";
import { Board, Ground, overlaps, Rails, ranked, type Segment } from "./place";
import { type Box, Field, type Rect, Scene, textBox } from "./scene";

const cond: Font = { family: "cond", weight: 500 };
const sans: Font = { family: "sans", weight: 400 };
const sansMedium: Font = { family: "sans", weight: 500 };

export type Region = { x0: number; y0: number; x1: number; y1: number };

const labelSizes = [48, 40, 32, 28, 24, 20, 16];

type Dot = { i: number; x: number; y: number; r: number; count: number };
const powerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

const clipX = (
	points: [number, number][],
	edge: number,
	keep: (x: number) => boolean,
) => {
	const out: [number, number][] = [];
	for (let k = 0; k < points.length; k++) {
		const a = points[k];
		const b = points[(k + 1) % points.length];
		const ina = keep(a[0]);
		const inb = keep(b[0]);
		if (ina) out.push(a);
		if (ina !== inb) {
			const t = (edge - a[0]) / (b[0] - a[0]);
			out.push([edge, a[1] + t * (b[1] - a[1])]);
		}
	}
	return out;
};

export const sheet = (
	x: number,
	y: number,
	w: number,
	h: number,
	from = 0,
	to = 1,
) => {
	const cut = h / 4;
	let points: [number, number][] = [
		[x, y],
		[x + w - cut, y],
		[x + w, y + cut],
		[x + w, y + h],
		[x, y + h],
	];
	const left = x + from * w;
	const right = x + to * w;
	if (from > 0) points = clipX(points, left, (v) => v >= left);
	if (to < 1) points = clipX(points, right, (v) => v <= right);
	return points.length
		? `M${points.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join("L")}Z`
		: "";
};

export const ladderSpec = (data: Data, L: number, K: number, room: number) => {
	const H = snap(L * 0.8);
	const inst = data.institutions;
	const shown = [...inst.keys()]
		.sort(
			(a, b) =>
				inst[a].rankExcess - inst[b].rankExcess ||
				inst[a].name.localeCompare(inst[b].name, "en"),
		)
		.slice(0, K);
	const values = (row: Institution) => [
		fixed(row.count),
		fixed(row.authors),
		hundredths(row.per),
		signed(row.excess),
		whole(row.rankCount),
	];
	const heads = ["Count", "Authors", "Per author", "Excess", "Count rank"];
	const widths = heads.map((h) => measure(h, H, sansMedium));
	for (const i of shown) {
		const v = values(inst[i]);
		for (let k = 0; k < v.length; k++)
			widths[k] = Math.max(
				widths[k],
				measure(v[k], L, k === 3 ? sansMedium : sans),
			);
	}
	const last = inst[shown[shown.length - 1]];
	const rankW = Math.max(
		measure(whole(last?.rankExcess ?? 1), L, sans),
		measure("Rank", H, sansMedium),
	);
	const flagW = Math.round(L * 1.2);
	const flagX = Math.round(rankW + L * 0.6);
	const nameX = Math.round(flagX + flagW + L * 0.5);
	const nameW = Math.ceil(
		Math.min(
			L * 32,
			Math.max(
				measure("Institution", H, sansMedium),
				...shown.map((i) => measure(clean(inst[i].name), L, cond)),
			),
		),
	);
	const numGap = Math.round(L * 1.2);
	const colGap = Math.round(L * 1.6);
	const rights: number[] = [];
	let run = nameX + nameW;
	for (const w of widths) {
		run += numGap + w;
		rights.push(run);
	}
	const most = Math.max(
		10,
		...shown.map((i) => Math.max(inst[i].rankCount, inst[i].rankExcess)),
	);
	const reach = Math.ceil(Math.log10(most) - 1e-9);
	const decades = Array.from({ length: reach + 1 }, (_, k) => 10 ** k);
	const tags = decades.map((d) => measure(whole(d), H, sans));
	let pace = Math.max(L * 2, tags[0] + tags[1] / 2 + L);
	for (let k = 2; k < tags.length; k++)
		pace = Math.max(pace, (tags[k - 1] + tags[k]) / 2 + L);
	const shiftX = run + colGap;
	const shiftW = Math.ceil(reach * pace + tags[tags.length - 1] / 2);
	const shiftAt = (rank: number) =>
		shiftX + Math.log10(Math.max(1, rank)) * pace;
	const block = Math.round(L * 0.6);
	const blockW = Math.round(block * 0.75);
	const blockGap = 2;
	const step = blockW + blockGap;
	const left = Math.max(0, ...shown.map((i) => papers(inst[i].expected)));
	const right = Math.max(0, ...shown.map((i) => papers(inst[i].excess)));
	const least = last ? papers(last.excess) : 0;
	const units = (v: number, u: number) => Math.ceil(v / u - 1e-9);
	let unit = least > 0 ? 2 ** Math.floor(Math.log2(least)) : 2 ** -8;
	while (units(left, unit) + units(right, unit) > 128) unit *= 2;
	const leftW = Math.max(
		units(left, unit) * step,
		measure("Expected", H, sansMedium) + L * 0.4,
	);
	const rightW = Math.max(
		units(right, unit) * step,
		measure("Excess", H, sansMedium) + L * 0.4,
	);
	const unitsX = shiftX + shiftW + colGap;
	const axis = Math.round(unitsX + leftW);
	const sparkX = Math.round(axis + rightW + colGap);
	const spark = Math.round(L * 0.3);
	const sparkW = Math.max(
		data.history.length * spark,
		measure("Count by year", H, sansMedium),
	);
	const width = Math.round(sparkX + sparkW);
	const headH = Math.round(H * 1.4 + 14);
	const rule_ = Math.round(L * 0.5);
	const pitch = Math.round(L * 1.3);
	const cache = new Map<number, string[]>();
	const lines = (i: number) => {
		let got = cache.get(i);
		if (!got) {
			got = wrap(clean(inst[i].name), L, cond, nameW);
			cache.set(i, got);
		}
		return got;
	};
	let count = 0;
	let height = headH + rule_;
	for (const [k, i] of shown.entries()) {
		if (k && powerOfTwo(k)) height += rule_;
		count += lines(i).length;
	}
	height += count * pitch;
	const fits = height <= room;
	const short = shown.some((i) => inst[i].count < inst[i].expected);
	const picked = new Set(data.selection.years);
	const head = (scene: Scene, x: number, y: number, end: number) => {
		const b = y + cap(H, sansMedium) + 4;
		scene.text(x + rankW, b, "Rank", H, sansMedium, grey, "end");
		scene.text(x + nameX, b, "Institution", H, sansMedium, grey);
		for (const [k, h] of heads.entries())
			scene.text(x + rights[k], b, h, H, sansMedium, grey, "end");
		for (const [k, d] of decades.entries())
			scene.text(
				x + shiftAt(d),
				b,
				whole(d),
				H,
				sans,
				grey,
				k === 0 ? "start" : "middle",
			);
		scene.text(x + axis - L * 0.4, b, "Expected", H, sansMedium, grey, "end");
		scene.text(x + axis + L * 0.4, b, "Excess", H, sansMedium, grey);
		scene.text(x + sparkX, b, "Count by year", H, sansMedium, grey);
		const top = y + headH - 7;
		scene.line(x, top, x + width, top, ink, 2);
		for (const d of decades)
			scene.line(x + shiftAt(d), top + 1, x + shiftAt(d), end, grid, 1.5);
		scene.line(x + axis, top + 1, x + axis, end, ink, 1.5);
		scene.line(x, end, x + width, end, ink, 2);
	};
	const row = (scene: Scene, x: number, y: number, i: number) => {
		const r = inst[i];
		const base = y + Math.round(pitch * 0.5 + cap(L, cond) / 2);
		const mid = base - cap(L, cond) / 2;
		scene.text(x + rankW, base, whole(r.rankExcess), L, sans, quiet, "end");
		if (r.country)
			scene.flag(r.country, x + flagX, mid - (flagW * 0.75) / 2, flagW);
		for (const [k, line] of lines(i).entries())
			scene.text(x + nameX, base + k * pitch, line, L, cond, ink);
		for (const [k, v] of values(r).entries())
			scene.text(
				x + rights[k],
				base,
				v,
				L,
				k === 3 ? sansMedium : sans,
				k === 4 ? grey : ink,
				"end",
			);
		const rose = r.rankExcess <= r.rankCount;
		const tone = rose ? gain : loss;
		const from = x + shiftAt(r.rankCount);
		const to = x + shiftAt(r.rankExcess);
		const dot = Math.max(3, L * 0.2);
		scene.line(from, mid, to, mid, tone, Math.max(1.5, L / 10));
		scene.dots(paper, 1, [[from, mid, dot]], tone, Math.max(1.5, L / 10));
		scene.dots(tone, 1, [[to, mid, dot]]);
		const e = papers(r.expected) / unit;
		const c = papers(r.count) / unit;
		const gap = Math.max(0, e - c);
		const top = mid - block / 2;
		const solid: string[] = [];
		const hollow: string[] = [];
		const lift: string[] = [];
		for (let j = 0; j < units(e, 1); j++) {
			const bx = x + axis - blockGap / 2 - (j + 1) * step + blockGap;
			const lo = j;
			const hi = Math.min(j + 1, e);
			const hollowTo = Math.min(hi, gap);
			if (hollowTo > lo)
				hollow.push(
					sheet(bx, top, blockW, block, 1 - (hollowTo - j), 1 - (lo - j)),
				);
			const solidFrom = Math.max(lo, gap);
			if (hi > solidFrom)
				solid.push(
					sheet(bx, top, blockW, block, 1 - (hi - j), 1 - (solidFrom - j)),
				);
		}
		const over = Math.max(0, c - e);
		for (let j = 0; j < units(over, 1); j++) {
			const bx = x + axis + blockGap / 2 + j * step;
			lift.push(sheet(bx, top, blockW, block, 0, Math.min(1, over - j)));
		}
		if (solid.length) scene.path(solid.join(""), par);
		if (lift.length) scene.path(lift.join(""), gain);
		if (hollow.length) scene.path(hollow.join(""), "none", loss, 1.5);
		const top_ = Math.max(...r.yearly, 1);
		const h = cap(L, sans);
		for (const [k, v] of r.yearly.entries()) {
			if (v <= 0) continue;
			const bh = Math.max(1.5, (v / top_) * h);
			scene.rect(
				x + sparkX + k * spark + 0.5,
				base - bh,
				spark - 1.5,
				bh,
				picked.has(data.history[k]) ? ink : rule,
			);
		}
		return mid;
	};
	return {
		L,
		K: shown.length,
		shown,
		pitch,
		fits,
		short,
		width,
		height,
		headH,
		rule: rule_,
		lines,
		head,
		row,
		unit,
		block,
		blockW,
	};
};

export const ladderFor = (data: Data, room: number) => {
	const n = data.institutions.length;
	for (const K of [128, 64, 32, 16, 8, 4, 2, 1])
		for (const L of [20, 16]) {
			const spec = ladderSpec(data, L, Math.min(K, n), room);
			if (spec.fits) return spec;
		}
	return ladderSpec(data, 16, 1, room);
};

type Spec = ReturnType<typeof ladderSpec>;

type Entry =
	| { kind: "row"; i: number; y: number; h: number }
	| { kind: "rule"; y: number };

const setup = (
	data: Data,
	region: Region,
	head: Masthead,
	key: { width: number; height: number },
	spec: Spec,
) => {
	const { x0, y0, x1, y1 } = region;
	const ladderX = x1 - spec.width;
	const fanW = 240;
	const xd1 = ladderX - fanW;
	const gapX = xd1 + 24;
	const inst = data.institutions;
	const A = inst.map((r) => papers(r.authors));
	const settled = (v: number) => Number(v.toPrecision(12));
	const E = inst.map((r) => settled(papers(r.excess)));
	const C = inst.map((r) => papers(r.count));
	const aLo = Math.log10(Math.min(...A)) - 0.15;
	const aHi = Math.log10(Math.max(...A)) + 0.06;
	const sx = (a: number) =>
		x0 + ((Math.log10(a) - aLo) / (aHi - aLo)) * (xd1 - x0);
	const ax = (x: number) => 10 ** (aLo + ((x - x0) / (xd1 - x0)) * (aHi - aLo));
	const abs = E.map(Math.abs).sort((a, b) => a - b);
	const median = abs[Math.floor(abs.length / 2)] || 1e-3;
	const c = 10 ** Math.round(Math.log10(median / 4));
	const g = (e: number) => Math.sign(e) * Math.log10(1 + Math.abs(e) / c);
	const gMax = g(Math.max(...E));
	const gMin = g(Math.min(...E));
	const span = gMax - gMin;
	const cMax = Math.max(...C);
	const rMax = 64;
	const rad = (n: number) => Math.max(2, rMax * Math.sqrt(n / cMax));
	const beta = settled(data.model.beta);
	const scale = settled(data.model.scale);
	const expected = (a: number) => scale * a ** beta;
	const base = gMax + 0.05 * span;
	let top = base;
	const bottom = gMin - 0.04 * span;
	const heads: Box[] = [
		...head.boxes.map((b) => ({
			x0: x0 + b.x0,
			y0: y0 + b.y0,
			x1: x0 + b.x1 + 64,
			y1: y0 + b.y1,
		})),
		{
			x0,
			y0: y0 + head.height,
			x1: x0 + key.width + 64,
			y1: y0 + head.height + 48 + key.height + 64,
		},
	];
	let sy = (e: number) => y0 + ((top - g(e)) / (top - bottom)) * (y1 - y0);
	let dots: Dot[] = [];
	const build = () => {
		sy = (e: number) => y0 + ((top - g(e)) / (top - bottom)) * (y1 - y0);
		dots = inst.map((_, i) => ({
			i,
			x: sx(A[i]),
			y: sy(E[i]),
			r: rad(C[i]),
			count: C[i],
		}));
	};
	let fitted = false;
	for (let k = 0; k < 64; k++) {
		build();
		const clear = (b: Box) =>
			!dots.some(
				(d) =>
					d.x - d.r < b.x1 &&
					d.x + d.r > b.x0 &&
					d.y - d.r < b.y1 &&
					d.y + d.r > b.y0,
			);
		if (heads.every(clear)) {
			fitted = true;
			break;
		}
		top += 0.04 * span;
	}
	return {
		x0,
		y0,
		x1,
		y1,
		ladderX,
		xd1,
		gapX,
		inst,
		A,
		E,
		C,
		aLo,
		aHi,
		sx,
		ax,
		c,
		g,
		top,
		bottom,
		span,
		cMax,
		expected,
		heads,
		sy,
		dots,
		fitted,
		base,
	};
};

export const probeFork = (
	data: Data,
	region: Region,
	head: Masthead,
	key: { width: number; height: number },
	spec: Spec,
) => {
	const f = setup(data, region, head, key, spec);
	return f.fitted ? (f.top - f.base) / f.span : Number.POSITIVE_INFINITY;
};

const frame = (
	data: Data,
	region: Region,
	head: Masthead,
	key: { width: number; height: number },
	spec: Spec,
) => {
	const {
		x0,
		y0,
		x1,
		y1,
		ladderX,
		xd1,
		gapX,
		inst,
		E,
		aLo,
		aHi,
		sx,
		ax,
		c,
		g,
		top,
		bottom,
		cMax,
		expected,
		heads,
		sy,
		dots,
	} = setup(data, region, head, key, spec);
	const zeroY = sy(0);
	const floorY = (x: number) => sy(-expected(ax(x)));
	const byIndex = new Map(dots.map((d) => [d.i, d]));

	const heightOf = (i: number) => spec.lines(i).length * spec.pitch;
	const entries: Entry[] = [];
	let ladderEnd = y0 + spec.headH;
	for (const [k, i] of spec.shown.entries()) {
		if (k && powerOfTwo(k)) {
			entries.push({ kind: "rule", y: ladderEnd + spec.rule / 2 });
			ladderEnd += spec.rule;
		}
		entries.push({ kind: "row", i, y: ladderEnd, h: heightOf(i) });
		ladderEnd += heightOf(i);
	}
	ladderEnd += spec.rule;

	const sorted = [...dots].sort((a, b) => a.x - a.r - (b.x - b.r));
	const reach: number[] = [];
	let low = zeroY;
	for (const d of sorted) {
		low = Math.max(low, d.y + d.r);
		reach.push(low);
	}
	const lowest = (edge: number) => {
		let lo = 0;
		let hi = sorted.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (sorted[mid].x - sorted[mid].r < edge) lo = mid + 1;
			else hi = mid;
		}
		return lo ? reach[lo - 1] : zeroY;
	};
	const tickBand = 64;
	const ceilingAt = (edge: number) =>
		Math.max(lowest(edge + 40), floorY(edge + 40), zeroY + tickBand) + 64;
	let mosaic: Rect = { x: x0, y: y1, w: 0, h: 0 };
	let best = 0;
	for (let edge = x0 + 0.3 * (xd1 - x0); edge <= xd1 - 64; edge += 16) {
		const ceiling = ceilingAt(edge) - 16;
		const w = edge - x0;
		const h = y1 - ceiling;
		if (h <= 0) continue;
		const area = w * h * Math.min(1, (2.6 * h) / w);
		if (area > best) {
			best = area;
			mosaic = { x: x0, y: ceiling, w, h };
		}
	}

	const inLadder = new Set<number>(spec.shown);

	return {
		x0,
		y0,
		x1,
		y1,
		ladderX,
		xd1,
		gapX,
		inst,
		E,
		aLo,
		aHi,
		sx,
		ax,
		c,
		g,
		top,
		bottom,
		cMax,
		expected,
		heads,
		sy,
		dots,
		zeroY,
		floorY,
		byIndex,
		entries,
		ladderEnd,
		mosaic,
		inLadder,
	};
};

export const plotFork = (
	data: Data,
	derived: Derived,
	region: Region,
	head: Masthead,
	key: { width: number; height: number },
	spec: Spec,
	beside?: Rect,
) => {
	const {
		x0,
		y0,
		x1,
		y1,
		ladderX,
		xd1,
		gapX,
		inst,
		E,
		aLo,
		aHi,
		sx,
		ax,
		c,
		g,
		top,
		bottom,
		cMax,
		expected,
		heads,
		sy,
		dots,
		zeroY,
		floorY,
		byIndex,
		entries,
		ladderEnd,
		mosaic,
		inLadder,
	} = frame(data, region, head, key, spec);

	const back = new Scene();
	const marks = new Scene();
	const front = new Scene();
	const holes: Box[] = [
		...heads,
		{
			x0: mosaic.x - 32,
			y0: mosaic.y - 32,
			x1: mosaic.x + mosaic.w + 32,
			y1: y1 + 1,
		},
	];
	const inHole = (x: number, y: number) =>
		holes.some((h) => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1);

	const decades: number[] = [];
	for (let e = Math.ceil(aLo); e <= Math.floor(aHi); e++) decades.push(10 ** e);
	const ticks: number[] = [0];
	const most = Math.max(...E.map(Math.abs));
	for (let e = Math.round(Math.log10(c)); 10 ** e <= most * 1.0001; e++) {
		if (g(10 ** e) <= top) ticks.push(10 ** e);
		if (-g(10 ** e) >= bottom) ticks.push(-(10 ** e));
	}
	const reachX = 96;
	for (const a of decades) {
		const x = sx(a);
		const near = dots.filter((d) => Math.abs(d.x - x) <= reachX);
		if (!near.length) continue;
		const from = Math.min(...near.map((d) => d.y - d.r)) - 64;
		const to = Math.min(y1, floorY(x));
		if (to - from < 96) continue;
		let start = from;
		for (const h of holes
			.filter((h) => x > h.x0 && x < h.x1)
			.sort((p, q) => p.y0 - q.y0)) {
			if (h.y1 < start || h.y0 > to) continue;
			if (h.y0 > start + 48) back.line(x, start, x, h.y0, grid, 2);
			start = Math.max(start, h.y1);
		}
		if (start < to - 48) back.line(x, start, x, to, grid, 2);
	}
	const tickSize = 24;
	const axisSize = 28;
	const gridStarts = new Map<number, number>();
	for (const t of ticks) {
		if (t === 0) continue;
		const y = sy(t);
		const near = dots.filter((d) => Math.abs(d.y - y) <= 48);
		if (!near.length) continue;
		let from = Math.max(x0, Math.min(...near.map((d) => d.x - d.r)) - 24);
		for (const h of holes)
			if (y > h.y0 - 8 && y < h.y1 + 8 && from > h.x0 - 8 && from < h.x1)
				from = h.x1 + 8;
		if (xd1 - from < 96) continue;
		gridStarts.set(t, from);
		let start = from;
		for (const h of holes
			.filter((h) => y > h.y0 && y < h.y1 && h.x1 > from)
			.sort((p, q) => p.x0 - q.x0)) {
			if (h.x0 > start) back.line(start, y, h.x0, y, grid, 2);
			start = Math.max(start, h.x1);
		}
		if (start < xd1) back.line(start, y, xd1, y, grid, 2);
	}

	const curves: { r: number; points: [number, number][]; colour: string }[] =
		[];
	const shade = (k: number) => classes[k];
	for (const [r, k] of [
		[2, 5],
		[4, 6],
		[8, 7],
		[0.5, 2],
	] as const) {
		const points: [number, number][] = [];
		for (let x = x0; x <= xd1; x += 8) {
			const y = sy((r - 1) * expected(ax(x)));
			if (Math.abs(y - zeroY) < 4 || y < y0 || y > y1 || inHole(x, y)) {
				if (points.length > 1) break;
				points.length = 0;
				continue;
			}
			points.push([x, y]);
		}
		if (points.length > 1) curves.push({ r, points, colour: shade(k) });
	}
	for (const cv of curves)
		back.path(
			cv.points
				.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
				.join(""),
			"none",
			cv.colour,
			3,
		);

	const floorPoints: [number, number][] = [];
	for (let x = x0; x <= xd1; x += 8) {
		const y = floorY(x);
		if (y - zeroY < 6) continue;
		if (y > y1) break;
		floorPoints.push([x, y]);
	}
	if (floorPoints.length > 1)
		back.path(
			floorPoints
				.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
				.join(""),
			"none",
			quiet,
			3,
		);

	const order = [...dots].sort((a, b) => b.count - a.count);
	const big = order.filter((d) => d.r >= 6);
	const small = order.filter((d) => d.r < 6);
	const colourOf = (d: Dot) => derived.colour(inst[d.i].country);
	let run: { fill: string; dots: [number, number, number][] } | undefined;
	for (const d of big) {
		const fill = colourOf(d);
		if (!run || run.fill !== fill) {
			run = { fill, dots: [] };
			marks.dots(fill, 0.9, run.dots, paper, 1.5);
		}
		run.dots.push([d.x, d.y, d.r]);
	}
	const groups = new Map<string, [number, number, number][]>();
	for (const d of small) {
		const fill = colourOf(d);
		const list = groups.get(fill) ?? [];
		list.push([d.x, d.y, d.r]);
		groups.set(fill, list);
	}
	for (const [fill, list] of groups) marks.dots(fill, 0.92, list);
	{
		let start = x0;
		for (const h of holes
			.filter((h) => zeroY > h.y0 && zeroY < h.y1)
			.sort((p, q) => p.x0 - q.x0)) {
			if (h.x0 > start) marks.line(start, zeroY, h.x0, zeroY, ink, 3);
			start = Math.max(start, h.x1);
		}
		if (start < xd1) marks.line(start, zeroY, xd1, zeroY, ink, 3);
	}

	const field = new Field(96);
	const written = new Field(96);
	const rails: Segment[] = [[x0, zeroY, xd1, zeroY]];
	for (let k = 1; k < floorPoints.length; k++)
		rails.push([
			floorPoints[k - 1][0],
			floorPoints[k - 1][1],
			floorPoints[k][0],
			floorPoints[k][1],
		]);
	for (const h of holes) {
		field.add(h);
		written.add(h);
	}
	const walls: Box[] = [
		{ x0: xd1 + 8, y0: y0 - 10, x1: x1 + 10, y1: ladderEnd + 64 },
		...(beside
			? [
					{
						x0: beside.x - 64,
						y0: beside.y - 96,
						x1: x1 + 10,
						y1: y1 + 10,
					},
				]
			: []),
	];
	for (const w of walls) {
		field.add(w);
		written.add(w);
	}
	const keep = (b: Box) => {
		field.add({ x0: b.x0 - 64, y0: b.y0, x1: b.x1 + 64, y1: b.y1 });
		written.add(b);
	};
	for (const a of decades) {
		const x = sx(a);
		if (x < x0 + 40 || x > xd1 - 40) continue;
		const text = decade(a);
		const y = zeroY + 44;
		const box = textBox(x, y, text, axisSize, sans, "middle", 6);
		if (holes.some((h) => overlaps(h, box))) continue;
		keep(box);
		front.text(x, y, text, axisSize, sans, grey, "middle", 8);
	}
	{
		const y = zeroY - 16;
		keep(textBox(xd1, y, "Count = Expected", axisSize, sansMedium, "end", 6));
		front.text(xd1, y, "Count = Expected", axisSize, sansMedium, ink, "end", 8);
		const yb = zeroY + 44;
		const box = textBox(xd1, yb, "Authors", axisSize, sansMedium, "end", 6);
		if (!written.hits(box)) {
			keep(box);
			front.text(xd1, yb, "Authors", axisSize, sansMedium, ink, "end", 8);
		}
	}
	let topTick: Box | undefined;
	for (const t of [...ticks].sort((a, b) => a - b)) {
		const y = sy(t);
		const font = t === 0 ? sansMedium : sans;
		const text = tick(t);
		const ty = y + cap(tickSize, font) / 2;
		let box: Box;
		let tx: number;
		let anchor: "start" | "end";
		if (t === 0) {
			tx = x0 + 12;
			anchor = "start";
			box = textBox(tx, y - 10, text, tickSize, font, "start", 6);
			if (written.hits(box)) continue;
			keep(box);
			front.text(tx, y - 10, text, tickSize, font, ink, "start", 8);
			continue;
		}
		const from = gridStarts.get(t);
		if (from === undefined) continue;
		tx = from - 12;
		anchor = "end";
		box = textBox(tx, ty, text, tickSize, font, anchor, 6);
		if (box.x0 < x0 || written.hits(box)) {
			tx = from + 12;
			anchor = "start";
			box = textBox(tx, y - 10, text, tickSize, font, anchor, 6);
			if (written.hits(box)) continue;
			keep(box);
			front.text(tx, y - 10, text, tickSize, font, grey, anchor, 8);
		} else {
			keep(box);
			front.text(tx, ty, text, tickSize, font, grey, anchor, 8);
		}
		if (t > 0) topTick = box;
	}
	if (topTick) {
		const tb = textBox(
			topTick.x1 - 6,
			topTick.y0 - 20,
			"Excess",
			axisSize,
			sansMedium,
			"end",
			6,
		);
		if (!written.hits(tb)) {
			keep(tb);
			front.text(
				topTick.x1 - 6,
				topTick.y0 - 20,
				"Excess",
				axisSize,
				sansMedium,
				ink,
				"end",
				8,
			);
		}
	}

	for (const d of dots)
		if (d.r >= 2.5)
			field.add({ x0: d.x - d.r, y0: d.y - d.r, x1: d.x + d.r, y1: d.y + d.r });

	const along = (
		points: [number, number][],
		text: string,
		size: number,
		font: Font,
		fill: string,
		below: boolean,
		fromRight: boolean,
	) => {
		const w = measure(text, size, font);
		const n = points.length;
		const idx = [...Array(n).keys()];
		if (fromRight) idx.reverse();
		for (const k of idx) {
			const [xa, ya] = points[k];
			let j = k;
			while (j < n - 1 && Math.hypot(points[j][0] - xa, points[j][1] - ya) < w)
				j++;
			if (Math.hypot(points[j][0] - xa, points[j][1] - ya) < w * 0.98) continue;
			const [xb, yb] = points[j];
			const angle = Math.atan2(yb - ya, xb - xa);
			const off = below ? 14 + cap(size, font) : -12;
			const bx = xa - Math.sin(angle) * off;
			const by = ya + Math.cos(angle) * off;
			const pieces: Box[] = [];
			for (let t = 0; t <= w; t += size * 0.5) {
				const px = bx + Math.cos(angle) * t;
				const py = by + Math.sin(angle) * t;
				const cx = px + Math.sin(angle) * size * 0.36;
				const cy = py - Math.cos(angle) * size * 0.36;
				pieces.push({
					x0: cx - size * 0.5,
					y0: cy - size * 0.5,
					x1: cx + size * 0.5,
					y1: cy + size * 0.5,
				});
			}
			if (
				pieces.some(
					(p) =>
						field.hits(p) || p.x0 < x0 || p.x1 > xd1 || p.y0 < y0 || p.y1 > y1,
				)
			)
				continue;
			front.text(
				bx,
				by,
				text,
				size,
				font,
				fill,
				"start",
				8,
				0,
				(angle * 180) / Math.PI,
			);
			for (const p of pieces) keep(p);
			return true;
		}
		return false;
	};
	if (floorPoints.length > 1)
		along(
			floorPoints.filter(([, y]) => y - zeroY > 160),
			"Count = 0",
			axisSize,
			sansMedium,
			grey,
			true,
			false,
		);
	const ratioText = (r: number) =>
		r >= 1
			? `Count = ${r} × Expected`
			: `Count = 1/${Math.round(1 / r)} × Expected`;
	for (const cv of curves) {
		const below = cv.r < 1;
		if (
			!along(
				cv.points,
				ratioText(cv.r),
				tickSize,
				sansMedium,
				grey,
				below,
				true,
			)
		)
			along(
				cv.points,
				cv.r >= 1 ? `${cv.r}×` : `1/${Math.round(1 / cv.r)}×`,
				tickSize,
				sansMedium,
				grey,
				below,
				true,
			);
	}

	const strings = new Scene();
	const labels = new Scene();
	const ladder = new Scene();
	const strands: Segment[] = [];
	const tieRow = (i: number, mid: number) => {
		const d = byIndex.get(i) as Dot;
		const tint = derived.colour(inst[i].country);
		const from = d.x + d.r + 2;
		strings.line(from, d.y, gapX, d.y, tint, 1.5);
		strings.line(gapX, d.y, ladderX - 12, mid, tint, 1.5);
		strands.push([from, d.y, gapX, d.y]);
		strands.push([gapX, d.y, ladderX - 12, mid]);
	};
	const drawBlock = (
		entries: Entry[],
		x: number,
		headY: number,
		end: number,
	) => {
		spec.head(ladder, x, headY, end);
		for (const e of entries) {
			if (e.kind === "rule") {
				ladder.line(x, e.y, x + spec.width, e.y, quiet, 1.5);
				continue;
			}
			const mid = spec.row(ladder, x, e.y, e.i);
			tieRow(e.i, mid);
		}
	};
	drawBlock(entries, ladderX, y0, ladderEnd);

	const inside = (b: Box) =>
		b.x0 >= x0 && b.x1 <= x1 && b.y0 >= y0 && b.y1 <= y1;
	const stepOf = (n: number) => Math.floor(Math.log2(cMax / n));
	const candidates = order.filter(
		(d) => !inLadder.has(d.i) && stepOf(d.count) < labelSizes.length,
	);
	type Placed = {
		d: Dot;
		s: number;
		x: number;
		y: number;
		box: Box;
		lead: Segment[];
	};
	const measureLabel = (d: Dot) => {
		const row = inst[d.i];
		const s = labelSizes[Math.max(0, stepOf(d.count))];
		const rank = row.excess > 0 ? whole(row.rankExcess) : "";
		const rankW = rank ? measure(`${rank} `, s, sans) : 0;
		const width = rankW + measure(clean(row.name), s, cond);
		const asc = cap(s, cond) + 2;
		const desc = s * 0.24;
		const pad = Math.max(3, s * 0.15);
		return { s, rank, rankW, width, asc, desc, pad };
	};
	const sizes = new Map<number, ReturnType<typeof measureLabel>>();
	const metrics = (d: Dot) => {
		let got = sizes.get(d.i);
		if (!got) {
			got = measureLabel(d);
			sizes.set(d.i, got);
		}
		return got;
	};
	const ground = new Ground(field.boxes(), written.boxes(), rails);
	const board = new Board();
	type Plan = {
		gx: Float64Array;
		gy: Float64Array;
		reach: Int8Array;
		soft: Int32Array;
		hard: Int32Array;
		seen: Float64Array;
	};
	const plans = new Map<number, Plan>();
	const tryPlace = (d: Dot): Placed | undefined => {
		const { s, width, asc, desc, pad } = metrics(d);
		const centre = (asc - desc) / 2;
		const boxAt = (x: number, y: number): Box => ({
			x0: x - pad,
			y0: y - asc - pad,
			x1: x + width + pad,
			y1: y + desc + pad,
		});
		const fixed_ = (box: Box) =>
			inside(box) && ground.clear(box.x0, box.y0, box.x1, box.y1);
		const tie = (box: Box): Segment => {
			const cx = Math.min(Math.max(d.x, box.x0), box.x1);
			const cy = Math.min(Math.max(d.y, box.y0 + 4), box.y1 - 4);
			const len = Math.hypot(cx - d.x, cy - d.y) || 1;
			return [
				d.x + ((cx - d.x) / len) * (d.r + 3),
				d.y + ((cy - d.y) / len) * (d.r + 3),
				cx,
				cy,
			];
		};
		const gap = d.r + s * 0.3;
		for (const [x, y] of [
			[d.x + gap, d.y + centre],
			[d.x - gap - width, d.y + centre],
			[d.x - width / 2, d.y - d.r - s * 0.2 - desc],
			[d.x - width / 2, d.y + d.r + s * 0.2 + asc],
		]) {
			const box = boxAt(x, y);
			if (fixed_(box) && board.covers(box) < 0)
				return { d, s, x, y, box, lead: [] };
		}
		let plan = plans.get(d.i);
		if (!plan) {
			const xs: number[] = [];
			for (let gx = x0; gx + width < x1; gx += 24) xs.push(gx);
			const ys: number[] = [];
			for (let gy = y0 + asc; gy + desc < y1; gy += 24) ys.push(gy);
			const dx = xs.map((gx) => Math.min(Math.max(d.x, gx), gx + width) - d.x);
			const dy = ys.map(
				(gy) => Math.min(Math.max(d.y, gy - asc), gy + desc) - d.y,
			);
			const dist: number[] = [];
			const cell: number[] = [];
			for (let a = 0; a < xs.length; a++) {
				if (Math.abs(dx[a]) >= 2400) continue;
				for (let b = 0; b < ys.length; b++) {
					if (Math.abs(dy[b]) >= 2400) continue;
					const far = Math.hypot(dx[a], dy[b]);
					if (far > d.r + 4 && far < 2400) {
						dist.push(far);
						cell.push(a * ys.length + b);
					}
				}
			}
			const under = inst[d.i].excess < 0;
			const kept: number[] = [];
			for (const k of ranked(dist)) {
				const x = xs[Math.floor(cell[k] / ys.length)];
				const y = ys[cell[k] % ys.length];
				const bx0 = x - pad;
				const by0 = y - asc - pad;
				const bx1 = x + width + pad;
				const by1 = y + desc + pad;
				if (
					bx0 >= x0 &&
					bx1 <= x1 &&
					by0 >= y0 &&
					by1 <= y1 &&
					ground.clear(bx0, by0, bx1, by1) &&
					(!under || dist[k] <= 512 || by0 > floorY(bx1))
				)
					kept.push(cell[k]);
			}
			plan = {
				gx: Float64Array.from(kept, (c) => xs[Math.floor(c / ys.length)]),
				gy: Float64Array.from(kept, (c) => ys[c % ys.length]),
				reach: new Int8Array(kept.length),
				soft: new Int32Array(kept.length).fill(-1),
				hard: new Int32Array(kept.length).fill(-1),
				seen: new Float64Array(kept.length).fill(-1),
			};
			plans.set(d.i, plan);
		}
		const { gx, gy, reach, soft, hard, seen } = plan;
		const now = board.now();
		let fallback = -1;
		for (let k = 0; k < gx.length; k++) {
			if (reach[k] === 2) continue;
			const crossed = hard[k] >= 0 && board.alive[hard[k]] === 1;
			if (crossed && fallback >= 0) continue;
			if (soft[k] >= 0 && board.alive[soft[k]]) continue;
			const box = boxAt(gx[k], gy[k]);
			const lead = tie(box);
			if (fallback >= 0) {
				hard[k] = board.crosses(lead);
				if (hard[k] >= 0) continue;
			}
			const from = soft[k] < 0 && seen[k] >= 0 ? board.after(seen[k]) : 0;
			let block = board.covers(box, from);
			if (block < 0) {
				if (!reach[k]) reach[k] = ground.reach(lead) ? 1 : 2;
				if (reach[k] === 2) continue;
				block = board.blocks(lead, from);
			}
			soft[k] = block;
			if (block >= 0) continue;
			seen[k] = now;
			if (fallback < 0) {
				if (crossed) {
					fallback = k;
					continue;
				}
				hard[k] = board.crosses(lead);
				if (hard[k] >= 0) {
					fallback = k;
					continue;
				}
			}
			return { d, s, x: gx[k], y: gy[k], box, lead: [lead] };
		}
		if (fallback < 0) return undefined;
		const box = boxAt(gx[fallback], gy[fallback]);
		return { d, s, x: gx[fallback], y: gy[fallback], box, lead: [tie(box)] };
	};
	const accepted: Placed[] = [];
	const orders: ((a: Dot, b: Dot) => number)[] = [
		(a, b) => b.count - a.count,
		(a, b) => a.x - b.x,
		(a, b) => b.x - a.x,
		(a, b) => a.y - b.y,
		(a, b) => b.y - a.y,
	];
	const name = (pool: Dot[], floor: number) => {
		for (let step = 0; step < labelSizes.length; step++) {
			const batch = pool.filter(
				(d) => Math.max(0, stepOf(d.count)) === step && d.count > floor,
			);
			const at = board.checkpoint();
			const reachOf = (d: Dot) => metrics(d).width + 256;
			const nearTo = (d: Dot, b: Box, reach: number) =>
				Math.hypot(
					Math.max(b.x0 - d.x, 0, d.x - b.x1),
					Math.max(b.y0 - d.y, 0, d.y - b.y1),
				) < reach;
			const settle = (sequence: Dot[], budget: number) => {
				const seq = [...sequence];
				const placed: Placed[] = [];
				const marks: number[] = [];
				let repairs = 0;
				let k = 0;
				while (k < seq.length) {
					marks[k] = board.checkpoint();
					const d = seq[k];
					const p = tryPlace(d);
					if (p) {
						board.add(
							board.id(
								`${d.i} ${p.x} ${p.y} ${p.lead.length}`,
								p.box,
								p.lead[0],
							),
						);
						placed[k] = p;
						k++;
						continue;
					}
					const reach = reachOf(d);
					let j = -1;
					for (let i = 0; i < k && j < 0; i++)
						if (
							nearTo(d, placed[i].box, reach) ||
							placed[i].lead.some((seg) =>
								nearTo(
									d,
									{
										x0: Math.min(seg[0], seg[2]),
										y0: Math.min(seg[1], seg[3]),
										x1: Math.max(seg[0], seg[2]),
										y1: Math.max(seg[1], seg[3]),
									},
									reach,
								),
							)
						)
							j = i;
					if (j < 0 || repairs >= budget) {
						board.rollback(at);
						return undefined;
					}
					repairs++;
					board.rollback(marks[j]);
					seq.splice(k, 1);
					seq.splice(j, 0, d);
					placed.length = j;
					k = j;
				}
				return placed;
			};
			let got: Placed[] | undefined;
			for (const order_ of orders) {
				got = settle([...batch].sort(order_), batch.length > 64 ? 0 : 32);
				if (got) break;
			}
			if (got) {
				accepted.push(...got);
				continue;
			}
			for (const d of [...batch].sort((a, b) => b.count - a.count)) {
				const p = tryPlace(d);
				if (!p) return d.count;
				board.add(
					board.id(`${d.i} ${p.x} ${p.y} ${p.lead.length}`, p.box, p.lead[0]),
				);
				accepted.push(p);
			}
		}
		return 0;
	};
	const floor = name(
		candidates.filter((d) => inst[d.i].excess > 0),
		0,
	);
	const above = accepted.length;
	name(
		candidates.filter((d) => inst[d.i].excess < 0),
		floor,
	);
	const ties = new Rails(strands);
	for (const p of accepted) {
		const row = inst[p.d.i];
		const { s, rank, rankW } = metrics(p.d);
		for (const seg of p.lead)
			strings.line(seg[0], seg[1], seg[2], seg[3], quiet, 1.5);
		if (ties.hits(p.box))
			labels.rect(
				p.box.x0,
				p.box.y0,
				p.box.x1 - p.box.x0,
				p.box.y1 - p.box.y0,
				paper,
			);
		if (rank) labels.text(p.x, p.y, rank, s, sans, quiet, "start", s * 0.25);
		labels.text(
			p.x + rankW,
			p.y,
			clean(row.name),
			s,
			cond,
			ink,
			"start",
			s * 0.25,
		);
	}

	return {
		back,
		marks,
		strings,
		labels: [labels, ladder],
		front,
		mosaic,
		headAt: { x: x0, y: y0 },
		placed: above,
		below: accepted.length - above,
		threshold: above
			? Math.min(...accepted.slice(0, above).map((p) => p.d.count))
			: 0,
		ladder: { rows: spec.K, size: spec.L, end: ladderEnd },
	};
};
