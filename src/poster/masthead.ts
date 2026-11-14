import { balance, cap, type Font, measure } from "./fonts";
import { list, plural, plurals, titled, whole } from "./format";
import type { Data } from "./model";
import { grey, ink, link } from "./palette";
import { qr } from "./qr";
import type { Scene } from "./scene";
import { maxOf, sans, sansBold, sansMedium } from "./sheet";

export type Meta = { label: string; value: string; link?: boolean }[];

export const stamp = (
	date: string,
	snapshot: string,
	release: string,
): Meta => [
	{ label: "Author", value: "clareLab" },
	{ label: "Contact", value: "https://clarelab.moe", link: true },
	{ label: "Date", value: date },
	{ label: "Data", value: `OpenAlex, ${snapshot}` },
	{ label: "Release", value: release },
];

export const brand = "AllRankings";

const level = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const series = (names: string[]) =>
	names.map((name, k) =>
		k === names.length - 1 && k
			? `and ${name}`
			: k < names.length - 2
				? `${name},`
				: name,
	);

export const selection = (data: Data) => {
	const parts: string[][] = [];
	if (data.view.level !== "all") parts.push([level(data.view.level)]);
	const [from, to] = [data.selection.from, data.selection.to];
	parts.push([from === to ? `${from}` : `${from} to ${to}`]);
	parts.push([list(data.selection.tiers.map((t) => `T${t}`))]);
	const child = data.levels.child;
	if (child) {
		const checked = data.children.length + data.zero.length;
		const noun = plural(data.levels.total, child, plurals(child));
		parts.push([
			checked < data.levels.total
				? `${whole(checked)} of ${noun}`
				: `all ${noun}`,
		]);
	}
	const places = data.selection.places;
	parts.push(places ? series(places) : ["all countries"]);
	const tiers = new Set(data.selection.tiers);
	const flips = data.selection.flip.map((key) => Number(key.split(".")[0]));
	const added = flips.filter((t) => !tiers.has(t)).length;
	const removed = flips.length - added;
	if (added) parts.push([plural(added, "listing added", "listings added")]);
	if (removed)
		parts.push([plural(removed, "listing removed", "listings removed")]);
	return parts.flatMap((part, k) =>
		part.map((word, j) =>
			j === part.length - 1 && k < parts.length - 1 ? `${word},` : word,
		),
	);
};

const fill = (
	words: string[],
	size: number,
	font: Font,
	room: number,
	gap = " ",
) => {
	const lines: string[] = [];
	for (const word of words) {
		const last = lines[lines.length - 1];
		if (
			last !== undefined &&
			measure(`${last}${gap}${word}`, size, font) <= room
		)
			lines[lines.length - 1] = `${last}${gap}${word}`;
		else lines.push(word);
	}
	return lines;
};

export const totals = (data: Data) => {
	const { kpi } = data;
	const tiers = list(kpi.tiers.map((t) => `T${t}`));
	return [
		plural(kpi.institutions, "institution", "institutions"),
		plural(kpi.countries, "country", "countries"),
		plural(kpi.venues, `${tiers} venue`, `${tiers} venues`),
	].join(", ");
};

export const heading = (data: Data) =>
	data.view.level === "all" ? brand : titled(data.view.name);

export type Masthead = {
	width: number;
	height: number;
	boxes: { x0: number; y0: number; x1: number; y1: number }[];
	draw: (scene: Scene, x: number, y: number) => void;
};

type Piece = {
	text: string;
	font: Font;
	fill: string;
	size: number;
	x: number;
	track?: number;
};

const markSize = 128;

const pathLine = (data: Data, room: number) => {
	const head = measure(brand, markSize, sansBold, -2);
	const sizes = [128, 112, 96, 80, 64, 56, 48, 40];
	const widthAt = (size: number) =>
		head +
		data.view.trail.reduce(
			(a, parent) =>
				a +
				2 * measure(" ", size, sansMedium) +
				measure("/", size, sansMedium) +
				measure(parent, size, sansMedium),
			0,
		);
	const size = sizes.find((v) => widthAt(v) <= room) ?? sizes[sizes.length - 1];
	const pieces: Piece[] = [
		{ text: brand, font: sansBold, fill: ink, size: markSize, x: 0, track: -2 },
	];
	const space = measure(" ", size, sansMedium);
	const slash = measure("/", size, sansMedium);
	let used = head;
	for (const parent of data.view.trail) {
		pieces.push({
			text: "/",
			font: sansMedium,
			fill: grey,
			size,
			x: used + space,
		});
		pieces.push({
			text: parent,
			font: sansMedium,
			fill: grey,
			size,
			x: used + 2 * space + slash,
		});
		used += 2 * space + slash + measure(parent, size, sansMedium);
	}
	return { pieces, width: used };
};

export const masthead = (
	data: Data,
	meta: Meta,
	room: number,
	most = 320,
): Masthead => {
	const markPitch = 144;
	const urlMax = 80;
	const lineSize = 40;
	const metaSize = 28;
	const top = data.view.level === "all";
	const name = heading(data);
	let titleSize = most;
	let title = balance(name, titleSize, sansBold, 1);
	for (; titleSize >= 128; titleSize -= 16) {
		let done = false;
		for (let n = 1; n <= 3; n++) {
			const set = balance(name, titleSize, sansBold, n);
			if (set.width <= room) {
				title = set;
				done = true;
				break;
			}
		}
		if (done) break;
	}
	const path = top ? undefined : pathLine(data, room);
	const labelW = Math.max(
		...meta.map((m) => measure(m.label, metaSize, sansMedium)),
	);
	const matrix = qr(data.url);
	const leading = Math.round(titleSize * 0.98);
	const steps: { y: number; draw: (s: Scene, x: number, y: number) => void }[] =
		[];
	let y = 0;
	if (path) {
		y = cap(markSize, sansBold);
		steps.push({
			y,
			draw: (s, x, b) => {
				for (const piece of path.pieces)
					s.text(
						x + piece.x,
						b,
						piece.text,
						piece.size,
						piece.font,
						piece.fill,
						"start",
						0,
						piece.track ?? 0,
					);
			},
		});
		y += markPitch;
	}
	y += cap(titleSize, sansBold);
	const titleTop = y;
	for (const [k, line] of title.lines.entries()) {
		const at = titleTop + k * leading;
		steps.push({
			y: at,
			draw: (s, x, b) =>
				s.text(
					x,
					b,
					line,
					titleSize,
					sansBold,
					ink,
					"start",
					0,
					-titleSize / 48,
				),
		});
	}
	y = titleTop + (title.lines.length - 1) * leading;
	const widest = Math.max(
		title.width,
		path ? path.width : measure(brand, markSize, sansBold),
	);
	const bound = Math.max(room, widest);
	let urlSize = urlMax;
	while (urlSize > 36 && measure(data.url, urlSize, sansMedium) > bound)
		urlSize -= 4;
	const address = fill(
		data.url.split(/(?<=,)/),
		urlSize,
		sansMedium,
		bound,
		"",
	);
	const urlW = maxOf(address.map((l) => measure(l, urlSize, sansMedium)));
	const urlPitch = Math.round(urlSize * 1.3);
	y += Math.round(titleSize * 0.36) + cap(urlSize, sansMedium);
	const urlY = y;
	steps.push({
		y: urlY,
		draw: (s, x, b) =>
			s.link(data.url, (inner) => {
				for (const [k, line] of address.entries())
					inner.text(x, b + k * urlPitch, line, urlSize, sansMedium, link);
			}),
	});
	y += (address.length - 1) * urlPitch;
	const pitch = Math.round(lineSize * 1.3);
	const metaPitch = Math.round(metaSize * 1.35);
	const textXOf = (n: number) => {
		const side =
			cap(lineSize, sans) + (n - 1) * pitch + 40 + meta.length * metaPitch;
		return Math.ceil(
			side + Math.max(64, Math.ceil((4 * side) / matrix.length)),
		);
	};
	const words = selection(data);
	const wrapped = (n: number) => [
		...fill(words, lineSize, sans, bound - textXOf(n)),
		totals(data),
	];
	let lines = wrapped(2);
	for (let k = 0; k < 8; k++) {
		const next = wrapped(lines.length);
		const settled = next.length === lines.length;
		lines = next;
		if (settled) break;
	}
	y += 40;
	const rows: { y: number; draw: (s: Scene, x: number, b: number) => void }[] =
		[];
	for (const line of lines) {
		y += pitch;
		rows.push({
			y,
			draw: (s, x, b) => s.text(x, b, line, lineSize, sans, ink),
		});
	}
	y += 40;
	for (const m of meta) {
		y += metaPitch;
		rows.push({
			y,
			draw: (s, x, b) => {
				s.text(x, b, m.label, metaSize, sansMedium, grey);
				if (m.link)
					s.link(m.value, (inner) =>
						inner.text(x + labelW + 24, b, m.value, metaSize, sans, link),
					);
				else s.text(x + labelW + 24, b, m.value, metaSize, sans, ink);
			},
		});
	}
	const qrTop = rows[0].y - cap(lineSize, sans);
	const side = y - qrTop;
	const unit = side / matrix.length;
	const qrGap = Math.max(64, Math.ceil(4 * unit));
	const textX = Math.ceil(side + qrGap);
	const infoW = Math.max(
		...lines.map((l) => measure(l, lineSize, sans)),
		...meta.map((m) => labelW + 24 + measure(m.value, metaSize, sans)),
	);
	const shape = (x0: number, y0: number) => {
		const f = (v: number) => v.toFixed(2);
		const modules: string[] = [];
		matrix.forEach((row, j) => {
			let k = 0;
			while (k < row.length) {
				if (!row[k]) {
					k++;
					continue;
				}
				let end = k;
				while (end < row.length && row[end]) end++;
				modules.push(
					`M${f(x0 + k * unit)} ${f(y0 + j * unit)}H${f(x0 + end * unit)}V${f(y0 + (j + 1) * unit)}H${f(x0 + k * unit)}Z`,
				);
				k = end;
			}
		});
		return modules.join("");
	};
	steps.push({
		y: qrTop,
		draw: (s, x, b) =>
			s.link(data.url, (inner) => inner.path(shape(x, b), ink)),
	});
	for (const row of rows)
		steps.push({ y: row.y, draw: (s, x, b) => row.draw(s, x + textX, b) });
	return {
		width: Math.max(title.width, urlW, textX + infoW),
		height: y + 12,
		boxes: [
			...(path ? [{ x0: 0, y0: 0, x1: path.width, y1: markPitch }] : []),
			{
				x0: 0,
				y0: path ? markPitch : 0,
				x1: title.width,
				y1: urlY - cap(urlSize, sansMedium),
			},
			{
				x0: 0,
				y0: urlY - cap(urlSize, sansMedium),
				x1: Math.max(urlW, textX + infoW),
				y1: y + 12,
			},
		],
		draw: (scene, x, at) => {
			for (const step of steps) step.draw(scene, x, at + step.y);
		},
	};
};
