import type * as Harfbuzz from "harfbuzzjs";
import { levels, mirror, order } from "./bidi";
import { extend, type Face, type Font, face, parse } from "./fonts";
import { clean } from "./format";

type Supply = {
	name: string;
	files: Record<string, string>;
	codes: [number, number][];
};

export type Weighted = {
	weight: number;
	file: string;
	bytes: ArrayBuffer;
	face: Face;
	font: Harfbuzz.Font;
};

type Family = {
	rank: number;
	name: string;
	codes: Set<number>;
	files: Record<string, string>;
	weights: Map<number, Weighted>;
};

export type Shape = {
	glyphs: number[];
	clusters: number[];
	advances: number[];
	dx: number[];
	dy: number[];
	width: number;
};

export type Piece = {
	text: string;
	family: number;
	rtl: boolean;
	name?: string;
	shape?: Shape;
	noto?: Weighted;
};

const families: Family[] = [];

const ignorable = (code: number) =>
	code === 0x200c ||
	code === 0x200d ||
	code === 0x34f ||
	(code >= 0xfe00 && code <= 0xfe0f) ||
	(code >= 0xe0100 && code <= 0xe01ef);

const clusters = (text: string) => {
	const out: string[] = [];
	for (const char of text) {
		const code = char.codePointAt(0) as number;
		if (
			out.length &&
			(code === 0x200c || code === 0x200d || /\p{M}/u.test(char))
		)
			out[out.length - 1] += char;
		else out.push(char);
	}
	return out;
};

const visible = (cluster: string) =>
	[...cluster]
		.map((char) => char.codePointAt(0) as number)
		.filter((code) => !ignorable(code));

const plain: Font = { family: "cond", weight: 400 };

const runs = (text: string, has: (code: number) => boolean) => {
	const out: { start: number; end: number; family: number }[] = [];
	let at = 0;
	for (const cluster of clusters(text)) {
		const codes = visible(cluster);
		const family = codes.every(has)
			? -1
			: families.findIndex((f) => codes.every((code) => f.codes.has(code)));
		const end = at + cluster.length;
		const last = out[out.length - 1];
		if (last && last.family === family) last.end = end;
		else out.push({ start: at, end, family });
		at = end;
	}
	return out;
};

export const uncovered = (text: string, font: Font) => {
	const { glyphs } = face(font);
	return clusters(text).filter((cluster) => {
		const codes = visible(cluster);
		return (
			!codes.every((code) => glyphs.has(code)) &&
			!families.some((f) => codes.every((code) => f.codes.has(code)))
		);
	});
};

export const files = () =>
	families.flatMap((f, k) =>
		Object.keys(f.files).map((weight) => ({
			name: f.name,
			codes: f.codes,
			face: weighted(k, Number(weight)).face,
		})),
	);

export const supplied = (text: string, font: Font) => {
	if (!families.length) return [];
	const { glyphs } = face(font);
	const used = new Set(
		runs(text, (code) => glyphs.has(code)).map((r) => r.family),
	);
	return families.filter((_, k) => used.has(k)).map((f) => f.name);
};

let harfbuzz: typeof Harfbuzz | undefined;
let loader: ((file: string) => ArrayBuffer) | undefined;

const weighted = (family: number, weight: number) => {
	const f = families[family];
	const near = Object.keys(f.files)
		.map(Number)
		.reduce((best, w) =>
			Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
		);
	let got = f.weights.get(near);
	if (!got) {
		const hb = harfbuzz as typeof Harfbuzz;
		const file = f.files[near];
		const bytes = (loader as (file: string) => ArrayBuffer)(file);
		got = {
			weight: near,
			file,
			bytes,
			face: parse(bytes),
			font: new hb.Font(new hb.Face(new hb.Blob(bytes))),
		};
		f.weights.set(near, got);
	}
	return got;
};

const shapes = new Map<string, Shape>();

const shape = (noto: Weighted, text: string, rtl: boolean) => {
	const key = `${noto.file}\u0000${rtl ? 1 : 0}\u0000${text}`;
	let got = shapes.get(key);
	if (got) return got;
	const hb = harfbuzz as typeof Harfbuzz;
	const buffer = new hb.Buffer();
	buffer.addText(text);
	buffer.setDirection(rtl ? hb.Direction.RTL : hb.Direction.LTR);
	buffer.guessSegmentProperties();
	hb.shape(noto.font, buffer);
	const infos = buffer.getGlyphInfos();
	const positions = buffer.getGlyphPositions();
	got = {
		glyphs: infos.map((i) => i.codepoint),
		clusters: infos.map((i) => i.cluster),
		advances: positions.map((p) => p.xAdvance),
		dx: positions.map((p) => p.xOffset),
		dy: positions.map((p) => p.yOffset),
		width: positions.reduce((a, p) => a + p.xAdvance, 0),
	};
	shapes.set(key, got);
	return got;
};

export const characters = (piece: Piece, into: Set<number>) => {
	for (const char of piece.text) {
		const code = char.codePointAt(0) as number;
		into.add(code);
		if (piece.rtl) into.add(mirror(code));
	}
};

const flip = (text: string) =>
	clusters(text)
		.reverse()
		.map((cluster) =>
			[...cluster]
				.map((char) =>
					String.fromCodePoint(mirror(char.codePointAt(0) as number)),
				)
				.join(""),
		)
		.join("");

const laid = new Map<string, Piece[] | undefined>();

export const lay = (text: string, font: Font) => {
	const key = `${font.family}${font.weight}\u0000${text}`;
	if (laid.has(key)) return laid.get(key);
	let out: Piece[] | undefined;
	if (families.length) {
		const { glyphs } = face(font);
		const list = runs(text, (code) => glyphs.has(code));
		if (list.some((r) => r.family >= 0)) {
			const codes: number[] = [];
			const starts: number[] = [];
			for (let i = 0; i < text.length; ) {
				const code = text.codePointAt(i) as number;
				codes.push(code);
				starts.push(i);
				i += code > 0xffff ? 2 : 1;
			}
			const level = levels(codes);
			const parts: {
				start: number;
				end: number;
				family: number;
				level: number;
			}[] = [];
			let r = 0;
			codes.forEach((_, k) => {
				const start = starts[k];
				while (list[r].end <= start) r++;
				const family = list[r].family;
				const end = k + 1 < codes.length ? starts[k + 1] : text.length;
				const last = parts[parts.length - 1];
				if (last && last.family === family && last.level === level[k])
					last.end = end;
				else parts.push({ start, end, family, level: level[k] });
			});
			out = order(parts.map((p) => p.level)).map((k) => {
				const { start, end, family, level: l } = parts[k];
				const rtl = l % 2 === 1;
				const slice = text.slice(start, end);
				if (family < 0) return { text: rtl ? flip(slice) : slice, family, rtl };
				const noto = weighted(family, font.weight);
				return {
					text: slice,
					family,
					rtl,
					name: families[family].name,
					noto,
					shape: shape(noto, slice, rtl),
				};
			});
		}
	}
	laid.set(key, out);
	return out;
};

const widths = new Map<string, number>();

const width = (text: string, size: number, font: Font, track: number) => {
	const key = `${font.family}${font.weight}\u0000${text}`;
	let em = widths.get(key);
	if (em === undefined) {
		const m = face(font);
		em = 0;
		for (const piece of lay(text, font) ?? [{ text, family: -1, rtl: false }]) {
			if (piece.noto && piece.shape)
				em += piece.shape.width / piece.noto.face.em;
			else {
				let units = 0;
				for (const char of piece.text)
					units += m.advance(char.codePointAt(0) as number);
				em += units / m.em;
			}
		}
		widths.set(key, em);
	}
	let count = 0;
	for (const _ of text) count++;
	return em * size + track * count;
};

const strings = (value: unknown, visit: (text: string) => void) => {
	if (typeof value === "string") visit(value);
	else if (Array.isArray(value)) for (const v of value) strings(v, visit);
	else if (value && typeof value === "object")
		for (const v of Object.values(value)) strings(v, visit);
};

export const prepare = async (
	data: unknown,
	read: (file: string) => Promise<ArrayBuffer>,
	load: (file: string) => ArrayBuffer,
) => {
	const { glyphs } = face(plain);
	const missing: number[][] = [];
	const seen = new Set<string>();
	strings(data, (text) => {
		let covered = true;
		for (let i = 0; i < text.length && covered; i++)
			covered =
				text.charCodeAt(i) < 0x80 || glyphs.has(text.codePointAt(i) as number);
		if (covered) return;
		for (const cluster of clusters(clean(text))) {
			if (seen.has(cluster)) continue;
			seen.add(cluster);
			const codes = visible(cluster);
			if (!codes.every((code) => glyphs.has(code))) missing.push(codes);
		}
	});
	if (!missing.length) return;
	const supply: Supply[] = JSON.parse(
		new TextDecoder().decode(await read("noto.json")),
	);
	const sets = supply.map((s) => {
		const codes = new Set<number>();
		for (const [from, to] of s.codes)
			for (let code = from; code <= to; code++) codes.add(code);
		return codes;
	});
	const needed = new Set<number>();
	for (const codes of missing) {
		const k = sets.findIndex((set) => codes.every((code) => set.has(code)));
		if (k >= 0 && !families.some((f) => f.name === supply[k].name))
			needed.add(k);
	}
	if (!needed.size) return;
	harfbuzz ??= await import("harfbuzzjs");
	loader = load;
	for (const k of needed)
		families.push({
			rank: k,
			name: supply[k].name,
			codes: sets[k],
			files: supply[k].files,
			weights: new Map(),
		});
	families.sort((a, b) => a.rank - b.rank);
	laid.clear();
	widths.clear();
	extend({
		covers: (code) => families.some((f) => f.codes.has(code)),
		width,
	});
};

const u32 = (view: DataView, at: number) => view.getUint32(at);

const sum = (bytes: Uint8Array) => {
	const padded = new Uint8Array((bytes.length + 3) & ~3);
	padded.set(bytes);
	const view = new DataView(padded.buffer);
	let total = 0;
	for (let at = 0; at < padded.length; at += 4)
		total = (total + u32(view, at)) >>> 0;
	return total;
};

const mapping = (glyphs: Map<number, number>, codes: Set<number>) => {
	const pairs = [...codes]
		.filter((code) => code <= 0xffff && glyphs.has(code))
		.sort((a, b) => a - b)
		.map((code) => [code, glyphs.get(code) as number]);
	const segments = [...pairs, [0xffff, 0]];
	const n = segments.length;
	const length = 16 + 8 * n;
	const out = new Uint8Array(12 + length);
	const v = new DataView(out.buffer);
	v.setUint16(2, 1);
	v.setUint16(4, 3);
	v.setUint16(6, 1);
	v.setUint32(8, 12);
	const at = 12;
	let pow = 1;
	while (pow * 2 <= n) pow *= 2;
	v.setUint16(at, 4);
	v.setUint16(at + 2, length);
	v.setUint16(at + 6, 2 * n);
	v.setUint16(at + 8, 2 * pow);
	v.setUint16(at + 10, Math.log2(pow));
	v.setUint16(at + 12, 2 * n - 2 * pow);
	segments.forEach(([code, glyph], k) => {
		v.setUint16(at + 14 + 2 * k, code);
		v.setUint16(at + 16 + 2 * n + 2 * k, code);
		v.setUint16(
			at + 16 + 4 * n + 2 * k,
			code === 0xffff ? 1 : (glyph - code) & 0xffff,
		);
	});
	return out;
};

export const subset = (
	noto: Weighted,
	used: Set<number>,
	codes: Set<number>,
) => {
	const { view, tables } = noto.face;
	const bytes = new Uint8Array(noto.bytes);
	const table = (tag: string) => tables.get(tag) as number;
	const length = (tag: string) => {
		const count = view.getUint16(4);
		for (let k = 0; k < count; k++) {
			const at = 12 + k * 16;
			const name = String.fromCharCode(
				...[0, 1, 2, 3].map((j) => view.getUint8(at + j)),
			);
			if (name === tag) return view.getUint32(at + 12);
		}
		return 0;
	};
	const glyphCount = view.getUint16(table("maxp") + 4);
	const long = view.getInt16(table("head") + 50) === 1;
	const loca = table("loca");
	const glyf = table("glyf");
	const offset = (g: number) =>
		long ? view.getUint32(loca + 4 * g) : 2 * view.getUint16(loca + 2 * g);
	const keep = new Set<number>([0]);
	const queue = [...used];
	while (queue.length) {
		const g = queue.pop() as number;
		if (keep.has(g) && g !== 0) continue;
		keep.add(g);
		const from = offset(g);
		if (offset(g + 1) === from || view.getInt16(glyf + from) >= 0) continue;
		let at = glyf + from + 10;
		for (;;) {
			const flags = view.getUint16(at);
			queue.push(view.getUint16(at + 2));
			at += 4 + (flags & 1 ? 4 : 2);
			if (flags & 8) at += 2;
			else if (flags & 0x40) at += 4;
			else if (flags & 0x80) at += 8;
			if (!(flags & 0x20)) break;
		}
	}
	const outlines: Uint8Array[] = [];
	const starts = new Uint32Array(glyphCount + 1);
	let size = 0;
	for (let g = 0; g < glyphCount; g++) {
		starts[g] = size;
		if (!keep.has(g)) continue;
		const from = offset(g);
		const to = offset(g + 1);
		const data = bytes.subarray(glyf + from, glyf + to);
		const padded = new Uint8Array((data.length + 3) & ~3);
		padded.set(data);
		outlines.push(padded);
		size += padded.length;
	}
	starts[glyphCount] = size;
	const newGlyf = new Uint8Array(size);
	let fill = 0;
	for (const part of outlines) {
		newGlyf.set(part, fill);
		fill += part.length;
	}
	const short = size < 0x20000;
	const newLoca = new Uint8Array((short ? 2 : 4) * (glyphCount + 1));
	const locaView = new DataView(newLoca.buffer);
	starts.forEach((s, g) => {
		if (short) locaView.setUint16(2 * g, s / 2);
		else locaView.setUint32(4 * g, s);
	});
	const keepTags = [...tables.keys()]
		.filter((tag) => !["DSIG", "hdmx", "LTSH", "VDMX"].includes(tag))
		.sort();
	const parts = keepTags.map((tag) => {
		if (tag === "glyf") return newGlyf;
		if (tag === "loca") return newLoca;
		if (tag === "cmap") return mapping(noto.face.glyphs, codes);
		const copy = bytes.slice(table(tag), table(tag) + length(tag));
		if (tag === "head") {
			const head = new DataView(copy.buffer);
			head.setUint32(8, 0);
			head.setInt16(50, short ? 0 : 1);
		}
		return copy;
	});
	const count = keepTags.length;
	let pow = 1;
	while (pow * 2 <= count) pow *= 2;
	const header = 12 + 16 * count;
	let total = header;
	const places = parts.map((part) => {
		const at = total;
		total += (part.length + 3) & ~3;
		return at;
	});
	const out = new Uint8Array(total);
	const o = new DataView(out.buffer);
	o.setUint32(0, 0x00010000);
	o.setUint16(4, count);
	o.setUint16(6, pow * 16);
	o.setUint16(8, Math.log2(pow));
	o.setUint16(10, count * 16 - pow * 16);
	keepTags.forEach((tag, k) => {
		const at = 12 + 16 * k;
		for (let j = 0; j < 4; j++) o.setUint8(at + j, tag.charCodeAt(j));
		o.setUint32(at + 4, sum(parts[k]));
		o.setUint32(at + 8, places[k]);
		o.setUint32(at + 12, parts[k].length);
		out.set(parts[k], places[k]);
	});
	const head = places[keepTags.indexOf("head")];
	o.setUint32(head + 8, (0xb1b0afba - sum(out)) >>> 0);
	return out;
};
