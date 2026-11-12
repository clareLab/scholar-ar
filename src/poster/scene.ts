import { type Font, families, measure } from "./fonts";
import { ink } from "./palette";

export type Anchor = "start" | "middle" | "end";

export type Item =
	| {
			kind: "text";
			x: number;
			y: number;
			text: string;
			size: number;
			family: string;
			weight: number;
			fill: string;
			anchor: Anchor;
			halo: number;
			track: number;
			rotate?: number;
	  }
	| {
			kind: "rect";
			x: number;
			y: number;
			w: number;
			h: number;
			fill: string;
			stroke?: string;
			sw?: number;
			opacity?: number;
	  }
	| {
			kind: "dots";
			fill: string;
			opacity: number;
			stroke?: string;
			sw?: number;
			dots: [number, number, number][];
	  }
	| {
			kind: "line";
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			stroke: string;
			sw: number;
			dash?: string;
	  }
	| {
			kind: "path";
			d: string;
			fill: string;
			stroke?: string;
			sw?: number;
			opacity?: number;
	  }
	| { kind: "flag"; code: string; x: number; y: number; w: number }
	| { kind: "link"; href: string; items: Item[] };

export type Box = { x0: number; y0: number; x1: number; y1: number };

export const r1 = (v: number) => Math.round(v * 10) / 10;

export class Scene {
	items: Item[] = [];
	flags = new Set<string>();

	text(
		x: number,
		y: number,
		text: string,
		size: number,
		font: Font,
		fill = ink,
		anchor: Anchor = "start",
		halo = 0,
		track = 0,
		rotate = 0,
	) {
		const item: Item = {
			kind: "text",
			x: r1(x),
			y: r1(y),
			text,
			size: r1(size),
			family: families[font.family],
			weight: font.weight,
			fill,
			anchor,
			halo: r1(halo),
			track: r1(track),
			rotate: rotate ? Math.round(rotate * 100) / 100 : undefined,
		};
		this.items.push(item);
		return item;
	}

	rect(
		x: number,
		y: number,
		w: number,
		h: number,
		fill: string,
		stroke?: string,
		sw?: number,
		opacity?: number,
	) {
		this.items.push({
			kind: "rect",
			x: r1(x),
			y: r1(y),
			w: r1(w),
			h: r1(h),
			fill,
			stroke,
			sw: sw === undefined ? sw : r1(sw),
			opacity,
		});
	}

	line(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		stroke: string,
		sw: number,
		dash?: string,
	) {
		this.items.push({
			kind: "line",
			x1: r1(x1),
			y1: r1(y1),
			x2: r1(x2),
			y2: r1(y2),
			stroke,
			sw,
			dash,
		});
	}

	path(
		d: string,
		fill: string,
		stroke?: string,
		sw?: number,
		opacity?: number,
	) {
		this.items.push({ kind: "path", d, fill, stroke, sw, opacity });
	}

	dots(
		fill: string,
		opacity: number,
		dots: [number, number, number][],
		stroke?: string,
		sw?: number,
	) {
		this.items.push({ kind: "dots", fill, opacity, dots, stroke, sw });
	}

	flag(code: string, x: number, y: number, w: number) {
		if (code) this.flags.add(code.toLowerCase());
		this.items.push({
			kind: "flag",
			code: code.toLowerCase(),
			x: r1(x),
			y: r1(y),
			w,
		});
	}

	link(href: string, draw: (scene: Scene) => void) {
		const inner = new Scene();
		draw(inner);
		for (const code of inner.flags) this.flags.add(code);
		this.items.push({ kind: "link", href, items: inner.items });
	}
}

export const textBox = (
	x: number,
	y: number,
	text: string,
	size: number,
	font: Font,
	anchor: Anchor = "start",
	pad = 0,
): Box => {
	const w = measure(text, size, font);
	const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
	return {
		x0: x0 - pad,
		y0: y - size * 0.74 - pad,
		x1: x0 + w + pad,
		y1: y + size * 0.22 + pad,
	};
};

export class Field {
	private cells = new Map<number, Box[]>();
	private all: Box[] = [];
	constructor(private size = 128) {}

	private keys(b: Box) {
		const out: number[] = [];
		const s = this.size;
		for (let i = Math.floor(b.x0 / s); i <= Math.floor(b.x1 / s); i++)
			for (let j = Math.floor(b.y0 / s); j <= Math.floor(b.y1 / s); j++)
				out.push(i * 100003 + j);
		return out;
	}

	hits(b: Box) {
		for (const key of this.keys(b))
			for (const o of this.cells.get(key) ?? [])
				if (b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)
					return true;
		return false;
	}

	add(b: Box) {
		this.all.push(b);
		for (const key of this.keys(b)) {
			const list = this.cells.get(key);
			if (list) list.push(b);
			else this.cells.set(key, [b]);
		}
	}

	boxes() {
		return this.all;
	}
}

export type Rect = { x: number; y: number; w: number; h: number };

export const squarify = (values: number[], box: Rect) => {
	const total = values.reduce((a, v) => a + v, 0);
	const out: Rect[] = [];
	if (!total || box.w <= 0 || box.h <= 0)
		return values.map(() => ({ x: box.x, y: box.y, w: 0, h: 0 }));
	const areas = values.map((v) => (v / total) * box.w * box.h);
	let { x, y, w, h } = box;
	let i = 0;
	while (i < areas.length) {
		const side = Math.min(w, h);
		let j = i;
		let sum = 0;
		let worst = Number.POSITIVE_INFINITY;
		while (j < areas.length) {
			const next = sum + areas[j];
			const ratio = Math.max(
				(side * side * areas[i]) / (next * next),
				(next * next) / (side * side * Math.max(areas[j], 1e-12)),
			);
			if (ratio > worst) break;
			worst = ratio;
			sum = next;
			j++;
		}
		const thick = side > 0 ? sum / side : 0;
		let along = 0;
		for (let k = i; k < j; k++) {
			const length = thick > 0 ? areas[k] / thick : 0;
			out.push(
				w >= h
					? { x, y: y + along, w: thick, h: length }
					: { x: x + along, y, w: length, h: thick },
			);
			along += length;
		}
		if (w >= h) {
			x += thick;
			w -= thick;
		} else {
			y += thick;
			h -= thick;
		}
		i = j;
	}
	return out;
};
