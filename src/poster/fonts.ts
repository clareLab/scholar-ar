export type Family = "sans" | "cond";
export type Weight = 400 | 500 | 600 | 700;
export type Font = { family: Family; weight: Weight };

export type Face = {
	em: number;
	cap: number;
	view: DataView;
	tables: Map<string, number>;
	glyphs: Map<number, number>;
	width: (glyph: number) => number;
	advance: (code: number) => number;
};

const faces = new Map<string, Face>();
const key = (font: Font) => `${font.family}${font.weight}`;

export const parse = (bytes: ArrayBuffer): Face => {
	const view = new DataView(bytes);
	const tables = new Map<string, number>();
	const count = view.getUint16(4);
	for (let k = 0; k < count; k++) {
		const at = 12 + k * 16;
		const tag = String.fromCharCode(
			...[0, 1, 2, 3].map((j) => view.getUint8(at + j)),
		);
		tables.set(tag, view.getUint32(at + 8));
	}
	const table = (tag: string) => {
		const at = tables.get(tag);
		if (at === undefined) throw new Error(`missing ${tag}`);
		return at;
	};
	const em = view.getUint16(table("head") + 18);
	const metrics = view.getUint16(table("hhea") + 34);
	const hmtx = table("hmtx");
	const width = (glyph: number) =>
		view.getUint16(hmtx + 4 * Math.min(glyph, metrics - 1));
	const cmap = table("cmap");
	const glyphs = new Map<number, number>();
	const subtables = view.getUint16(cmap + 2);
	for (let k = 0; k < subtables; k++) {
		const platform = view.getUint16(cmap + 4 + k * 8);
		const encoding = view.getUint16(cmap + 6 + k * 8);
		const at = cmap + view.getUint32(cmap + 8 + k * 8);
		const format = view.getUint16(at);
		if (format === 4 && platform === 3 && encoding === 1) {
			const segments = view.getUint16(at + 6) / 2;
			const ends = at + 14;
			const starts = ends + 2 * segments + 2;
			const deltas = starts + 2 * segments;
			const offsets = deltas + 2 * segments;
			for (let s = 0; s < segments; s++) {
				const end = view.getUint16(ends + 2 * s);
				const start = view.getUint16(starts + 2 * s);
				const delta = view.getInt16(deltas + 2 * s);
				const offset = view.getUint16(offsets + 2 * s);
				for (let c = start; c <= end && c !== 0xffff; c++) {
					let glyph: number;
					if (offset === 0) glyph = (c + delta) & 0xffff;
					else {
						const g = view.getUint16(
							offsets + 2 * s + offset + 2 * (c - start),
						);
						glyph = g === 0 ? 0 : (g + delta) & 0xffff;
					}
					if (!glyphs.has(c)) glyphs.set(c, glyph);
				}
			}
		}
	}
	const fallback = width(glyphs.get(0x6e) ?? 0);
	const os2 = table("OS/2");
	return {
		em,
		cap: view.getInt16(os2 + 88),
		view,
		tables,
		glyphs,
		width,
		advance: (code) => {
			const glyph = glyphs.get(code);
			return glyph === undefined ? fallback : width(glyph);
		},
	};
};

export const files: Record<string, string> = {
	sans400: "IBMPlexSans-Regular.otf",
	sans500: "IBMPlexSans-Medium.otf",
	sans600: "IBMPlexSans-SemiBold.otf",
	sans700: "IBMPlexSans-Bold.otf",
	cond400: "IBMPlexSansCondensed-Regular.otf",
	cond500: "IBMPlexSansCondensed-Medium.otf",
	cond600: "IBMPlexSansCondensed-SemiBold.otf",
};

export const load = async (read: (file: string) => Promise<ArrayBuffer>) => {
	const bytes = new Map<string, ArrayBuffer>();
	await Promise.all(
		Object.entries(files).map(async ([name, file]) => {
			const got = await read(file);
			bytes.set(file, got);
			faces.set(name, parse(got));
		}),
	);
	return bytes;
};

export const face = (font: Font) => {
	const found = faces.get(key(font));
	if (!found) throw new Error(`font ${key(font)} not loaded`);
	return found;
};

const metrics = face;

export const families: Record<Family, string> = {
	sans: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
	cond: "'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif",
};

export const fontOf = (family: string, weight: number): Font => ({
	family: family === families.cond ? "cond" : "sans",
	weight: weight as Weight,
});

export const embedded: [string, number, string][] = [
	["IBM Plex Sans", 400, files.sans400],
	["IBM Plex Sans", 500, files.sans500],
	["IBM Plex Sans", 600, files.sans600],
	["IBM Plex Sans", 700, files.sans700],
	["IBM Plex Sans Condensed", 400, files.cond400],
	["IBM Plex Sans Condensed", 500, files.cond500],
	["IBM Plex Sans Condensed", 600, files.cond600],
];

export const cap = (size: number, font: Font) => {
	const m = metrics(font);
	return (m.cap / m.em) * size;
};

type Extension = {
	covers: (code: number) => boolean;
	width: (text: string, size: number, font: Font, track: number) => number;
};

let extension: Extension | undefined;

export const extend = (more: Extension) => {
	extension = more;
};

export const measure = (text: string, size: number, font: Font, track = 0) => {
	const m = metrics(font);
	let units = 0;
	let glyphs = 0;
	for (const char of text) {
		const code = char.codePointAt(0) as number;
		if (extension && !m.glyphs.has(code) && extension.covers(code))
			return extension.width(text, size, font, track);
		units += m.advance(code);
		glyphs++;
	}
	return (units / m.em) * size + track * glyphs;
};

const glue = new Set([
	"&",
	"a",
	"an",
	"and",
	"at",
	"de",
	"del",
	"der",
	"des",
	"di",
	"do",
	"du",
	"for",
	"in",
	"la",
	"le",
	"of",
	"on",
	"the",
	"to",
	"und",
	"y",
]);

const units = (text: string) => {
	const words = text.split(" ").filter(Boolean);
	const out: string[] = [];
	for (let k = 0; k < words.length; k++) {
		const word = words[k];
		if (glue.has(word.toLowerCase()) && k < words.length - 1) {
			words[k + 1] = `${word} ${words[k + 1]}`;
			continue;
		}
		if (out.length && ["–", "—", "-", "/"].includes(word)) {
			out[out.length - 1] = `${out[out.length - 1]} ${word}`;
			continue;
		}
		out.push(word);
	}
	return out;
};

const plain = (line: string) => line.replaceAll(" ", " ");

export const wrap = (text: string, size: number, font: Font, max: number) => {
	const words = units(text);
	const out: string[] = [];
	let line = "";
	for (const word of words) {
		const next = line ? `${line} ${word}` : word;
		if (line && measure(plain(next), size, font) > max) {
			out.push(line);
			line = word;
		} else line = next;
	}
	if (line) out.push(line);
	return out.map(plain);
};

export const balance = (
	text: string,
	size: number,
	font: Font,
	lines: number,
) => {
	const words = units(text);
	const n = Math.min(lines, words.length);
	const width = (from: number, to: number) =>
		measure(plain(words.slice(from, to).join(" ")), size, font);
	if (n <= 1)
		return { lines: [plain(words.join(" "))], width: width(0, words.length) };
	let best = { cost: Number.POSITIVE_INFINITY, cuts: [] as number[] };
	const search = (
		from: number,
		left: number,
		cuts: number[],
		worst: number,
	) => {
		if (worst >= best.cost) return;
		if (left === 1) {
			const cost = Math.max(worst, width(from, words.length));
			if (cost < best.cost) best = { cost, cuts };
			return;
		}
		for (let cut = from + 1; cut <= words.length - left + 1; cut++)
			search(cut, left - 1, [...cuts, cut], Math.max(worst, width(from, cut)));
	};
	search(0, n, [], 0);
	const bounds = [0, ...best.cuts, words.length];
	return {
		lines: bounds
			.slice(1)
			.map((to, k) => plain(words.slice(bounds[k], to).join(" "))),
		width: best.cost,
	};
};

export const fit = (
	text: string,
	size: number,
	font: Font,
	max: number,
	most: number,
) => {
	const words = units(text).length;
	for (let n = 1; n <= Math.min(most, words); n++) {
		const set = balance(text, size, font, n);
		if (set.width <= max) return set;
	}
	return undefined;
};
