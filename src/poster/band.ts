import { fontOf, measure } from "./fonts";
import { supplied } from "./noto";
import type { Item } from "./scene";

const margin = 16;

const extent = (item: Item): [number, number] => {
	if (item.kind === "rect") {
		const s = item.sw ?? 0;
		return [item.y - s, item.y + item.h + s];
	}
	if (item.kind === "line")
		return [
			Math.min(item.y1, item.y2) - item.sw,
			Math.max(item.y1, item.y2) + item.sw,
		];
	if (item.kind === "path") {
		const ys: number[] = [];
		for (const [, cmd, args] of item.d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
			const v = args.trim().split(/[ ,]+/).filter(Boolean).map(Number);
			if (cmd === "V") ys.push(...v);
			else if (cmd !== "H") ys.push(...v.filter((_, k) => k % 2));
		}
		const s = item.sw ?? 0;
		return [Math.min(...ys) - s, Math.max(...ys) + s];
	}
	if (item.kind === "text") {
		const pad = 2 * item.size + item.halo;
		const r = item.rotate
			? measure(
					item.text,
					item.size,
					fontOf(item.family, item.weight),
					item.track,
				) + pad
			: pad;
		return [item.y - r, item.y + r];
	}
	if (item.kind === "flag") return [item.y, item.y + item.w * 0.75];
	return [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
};

const reaches = new WeakMap<Item, [number, number]>();

const reach = (item: Item) => {
	let got = reaches.get(item);
	if (!got) {
		got = extent(item);
		reaches.set(item, got);
	}
	return got;
};

export const slice = (items: Item[], top: number, bottom: number): Item[] => {
	const out: Item[] = [];
	for (const item of items) {
		if (item.kind === "dots") {
			const s = item.sw ?? 0;
			const dots = item.dots.filter(
				([, cy, r]) =>
					cy + r + s + margin >= top && cy - r - s - margin <= bottom,
			);
			if (dots.length) out.push({ ...item, dots });
		} else if (item.kind === "link") {
			const inner = slice(item.items, top, bottom);
			if (inner.length) out.push({ ...item, items: inner });
		} else {
			const [y0, y1] = reach(item);
			if (y1 + margin >= top && y0 - margin <= bottom) out.push(item);
		}
	}
	return out;
};

export const weight = (items: Item[]): number => {
	let n = 0;
	for (const item of items) {
		if (item.kind === "dots") n += item.dots.length;
		else if (item.kind === "link") n += weight(item.items);
		else if (item.kind !== "flag") n++;
	}
	return n;
};

export type Flag = Extract<Item, { kind: "flag" }>;

export const used = (
	items: Item[],
	flags: Flag[] = [],
	faces = new Set<string>(),
) => {
	for (const item of items) {
		if (item.kind === "flag") flags.push(item);
		else if (item.kind === "text") {
			faces.add(`${item.family}${item.weight}`);
			for (const name of supplied(item.text, fontOf(item.family, item.weight)))
				faces.add(`${name}${item.weight}`);
		} else if (item.kind === "link") used(item.items, flags, faces);
	}
	return { flags, faces };
};
