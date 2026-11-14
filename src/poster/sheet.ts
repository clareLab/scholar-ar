import { cap, type Font, measure } from "./fonts";
import { grey, ink } from "./palette";
import type { Scene } from "./scene";

export const sans: Font = { family: "sans", weight: 400 };
export const sansMedium: Font = { family: "sans", weight: 500 };
export const sansSemi: Font = { family: "sans", weight: 600 };
export const sansBold: Font = { family: "sans", weight: 700 };
export const cond: Font = { family: "cond", weight: 400 };
export const condMedium: Font = { family: "cond", weight: 500 };
export const condSemi: Font = { family: "cond", weight: 600 };

export const titleSize = 40;
export const titleBand = 112;

export type Row = {
	height: number;
	keep?: boolean;
	draw: (scene: Scene, x: number, y: number) => void;
};

export type Block = {
	width: number;
	height: number;
	cols: number;
	colW: number;
	gap: number;
	draw: (scene: Scene, x: number, y: number, gap: number, full: number) => void;
};

export type Grid = { n: number; w: number; g: number };

export const gridOf = (width: number, n: number, g: number): Grid => ({
	n,
	w: (width - (n - 1) * g) / n,
	g,
});

export type Sheet = {
	height: number;
	draw: (scene: Scene, x: number, y: number) => void;
};

export const flow = (rows: Row[], room: number) => {
	const columns: Row[][] = [[]];
	let used = 0;
	for (let k = 0; k < rows.length; k++) {
		const row = rows[k];
		const next = rows[k + 1];
		const need = row.height + (row.keep && next ? next.height : 0);
		if (used + need > room && columns[columns.length - 1].length) {
			columns.push([]);
			used = 0;
		}
		columns[columns.length - 1].push(row);
		used += row.height;
	}
	return columns;
};

export const pack = (rows: Row[], n: number) => {
	const total = rows.reduce((a, r) => a + r.height, 0);
	let lo = Math.max(0, Math.floor(total / n) - 1);
	let hi = Math.max(Math.ceil(total), 1);
	while (hi - lo > 1) {
		const mid = Math.floor((lo + hi) / 2);
		if (flow(rows, mid).length <= n) hi = mid;
		else lo = mid;
	}
	return flow(rows, hi);
};

export const blockTitle = (
	scene: Scene,
	x: number,
	y: number,
	w: number,
	text: string,
	note: string,
) => {
	const base = y + cap(titleSize, sansSemi);
	scene.text(
		x,
		base,
		text,
		titleSize,
		sansSemi,
		ink,
		"start",
		0,
		titleSize * 0.1,
	);
	if (note) scene.text(x + w, base, note, 28, sans, grey, "end");
	scene.line(x, y + 72, x + w, y + 72, ink, 4);
};

export const divider = (
	scene: Scene,
	x: number,
	y: number,
	w: number,
	s: number,
	text: string,
) => {
	const mid = y + s * 0.62;
	const room = measure("93.75%", s, sansSemi) + s * 0.6;
	scene.line(x, mid, x + w - room, mid, ink, Math.max(2, s / 8));
	scene.text(x + w, mid + cap(s, sansSemi) / 2, text, s, sansSemi, ink, "end");
};

export const minOf = (values: number[]) =>
	values.reduce((a, v) => Math.min(a, v), Number.POSITIVE_INFINITY);

export const maxOf = (values: number[]) =>
	values.reduce((a, v) => Math.max(a, v), Number.NEGATIVE_INFINITY);

export const radius = (most: number) => (n: number) =>
	Math.max(2, 64 * Math.sqrt(n / most));

export const percentOf = (k: number) =>
	["50%", "75%", "87.5%", "93.75%"][k - 1];
