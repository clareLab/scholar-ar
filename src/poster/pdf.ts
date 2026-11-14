import { mirror } from "./bidi";
import { type Face, type Font, face, files, fontOf } from "./fonts";
import {
	characters,
	lay,
	type Piece,
	type Shape,
	subset,
	type Weighted,
} from "./noto";
import type { Item } from "./scene";
import { frame } from "./svg";
import { crc32 } from "./zip";

export type Raster = { width: number; height: number; rgba: Uint8ClampedArray };

type Text = Extract<Item, { kind: "text" }>;

const lookups = (f: Face, tag: string, feature: string) => {
	const base = f.tables.get(tag);
	if (base === undefined) return [];
	const v = f.view;
	const scripts = base + v.getUint16(base + 4);
	const features = base + v.getUint16(base + 6);
	const list = base + v.getUint16(base + 8);
	let lang = -1;
	for (let k = 0; k < v.getUint16(scripts); k++) {
		const at = scripts + 2 + k * 6;
		const name = String.fromCharCode(
			...[0, 1, 2, 3].map((j) => v.getUint8(at + j)),
		);
		if (name !== "latn" && !(name === "DFLT" && lang < 0)) continue;
		const script = scripts + v.getUint16(at + 4);
		const offset = v.getUint16(script);
		if (offset) lang = script + offset;
	}
	if (lang < 0) return [];
	const out: number[] = [];
	for (let k = 0; k < v.getUint16(lang + 4); k++) {
		const index = v.getUint16(lang + 6 + 2 * k);
		const at = features + 2 + index * 6;
		const name = String.fromCharCode(
			...[0, 1, 2, 3].map((j) => v.getUint8(at + j)),
		);
		if (name !== feature) continue;
		const table = features + v.getUint16(at + 4);
		for (let j = 0; j < v.getUint16(table + 2); j++)
			out.push(v.getUint16(table + 4 + 2 * j));
	}
	return [...new Set(out)]
		.sort((a, b) => a - b)
		.map((index) => {
			const lookup = list + v.getUint16(list + 2 + 2 * index);
			const type = v.getUint16(lookup);
			const subtables: [number, number][] = [];
			const extension = tag === "GPOS" ? 9 : 7;
			for (let j = 0; j < v.getUint16(lookup + 4); j++) {
				const sub = lookup + v.getUint16(lookup + 6 + 2 * j);
				if (type === extension)
					subtables.push([v.getUint16(sub + 2), sub + v.getUint32(sub + 4)]);
				else subtables.push([type, sub]);
			}
			return subtables;
		});
};

const coverage = (v: DataView, at: number, glyph: number) => {
	const format = v.getUint16(at);
	if (format === 1) {
		let lo = 0;
		let hi = v.getUint16(at + 2) - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			const g = v.getUint16(at + 4 + 2 * mid);
			if (g === glyph) return mid;
			if (g < glyph) lo = mid + 1;
			else hi = mid - 1;
		}
		return -1;
	}
	if (format === 2) {
		let lo = 0;
		let hi = v.getUint16(at + 2) - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			const r = at + 4 + 6 * mid;
			if (glyph < v.getUint16(r)) hi = mid - 1;
			else if (glyph > v.getUint16(r + 2)) lo = mid + 1;
			else return v.getUint16(r + 4) + glyph - v.getUint16(r);
		}
	}
	return -1;
};

const classOf = (v: DataView, at: number, glyph: number) => {
	const format = v.getUint16(at);
	if (format === 1) {
		const start = v.getUint16(at + 2);
		const count = v.getUint16(at + 4);
		return glyph >= start && glyph < start + count
			? v.getUint16(at + 6 + 2 * (glyph - start))
			: 0;
	}
	if (format === 2) {
		let lo = 0;
		let hi = v.getUint16(at + 2) - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			const r = at + 4 + 6 * mid;
			if (glyph < v.getUint16(r)) hi = mid - 1;
			else if (glyph > v.getUint16(r + 2)) lo = mid + 1;
			else return v.getUint16(r + 4);
		}
	}
	return 0;
};

const bits = (format: number) => {
	let n = 0;
	for (let f = format; f; f >>= 1) n += f & 1;
	return 2 * n;
};

const advanceOf = (v: DataView, at: number, format: number) =>
	format & 4 ? v.getInt16(at + bits(format & 3)) : 0;

const pair = (
	v: DataView,
	[type, at]: [number, number],
	a: number,
	b: number,
) => {
	if (type !== 2) return undefined;
	const index = coverage(v, at + v.getUint16(at + 2), a);
	if (index < 0) return undefined;
	const format = v.getUint16(at);
	const f1 = v.getUint16(at + 4);
	const f2 = v.getUint16(at + 6);
	const size = bits(f1) + bits(f2);
	if (format === 1) {
		const set = at + v.getUint16(at + 10 + 2 * index);
		let lo = 0;
		let hi = v.getUint16(set) - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			const r = set + 2 + mid * (2 + size);
			const g = v.getUint16(r);
			if (g === b) return advanceOf(v, r + 2, f1);
			if (g < b) lo = mid + 1;
			else hi = mid - 1;
		}
		return undefined;
	}
	if (format === 2) {
		const c1 = classOf(v, at + v.getUint16(at + 8), a);
		const c2 = classOf(v, at + v.getUint16(at + 10), b);
		const n1 = v.getUint16(at + 12);
		const n2 = v.getUint16(at + 14);
		if (c1 >= n1 || c2 >= n2) return undefined;
		return advanceOf(v, at + 16 + (c1 * n2 + c2) * size, f1);
	}
	return undefined;
};

type Shaper = {
	face: Face;
	name: string;
	kern: [number, number][][];
	liga: [number, number][][];
};

const shapers = new Map<string, Shaper>();

const nameOf = (f: Face) => {
	const v = f.view;
	const at = f.tables.get("name") as number;
	const strings = at + v.getUint16(at + 4);
	for (let k = 0; k < v.getUint16(at + 2); k++) {
		const r = at + 6 + 12 * k;
		if (v.getUint16(r + 6) !== 6) continue;
		const platform = v.getUint16(r);
		const length = v.getUint16(r + 8);
		const offset = strings + v.getUint16(r + 10);
		if (platform === 3)
			return String.fromCharCode(
				...Array.from({ length: length / 2 }, (_, j) =>
					v.getUint16(offset + 2 * j),
				),
			);
		if (platform === 1)
			return String.fromCharCode(
				...Array.from({ length }, (_, j) => v.getUint8(offset + j)),
			);
	}
	return "Font";
};

const shaper = (font: Font) => {
	const key = `${font.family}${font.weight}`;
	let got = shapers.get(key);
	if (!got) {
		const f = face(font);
		got = {
			face: f,
			name: nameOf(f),
			kern: lookups(f, "GPOS", "kern"),
			liga: lookups(f, "GSUB", "liga"),
		};
		shapers.set(key, got);
	}
	return got;
};

const ligate = (s: Shaper, glyphs: number[], codes: string[]) => {
	const v = s.face.view;
	for (const subtables of s.liga) {
		for (let i = 0; i < glyphs.length; i++) {
			for (const [type, at] of subtables) {
				if (type !== 4) continue;
				const index = coverage(v, at + v.getUint16(at + 2), glyphs[i]);
				if (index < 0) continue;
				const set = at + v.getUint16(at + 6 + 2 * index);
				let done = false;
				for (let k = 0; k < v.getUint16(set) && !done; k++) {
					const lig = set + v.getUint16(set + 2 + 2 * k);
					const n = v.getUint16(lig + 2);
					if (i + n > glyphs.length) continue;
					let match = true;
					for (let j = 1; j < n && match; j++)
						match = v.getUint16(lig + 4 + 2 * (j - 1)) === glyphs[i + j];
					if (!match) continue;
					glyphs.splice(i, n, v.getUint16(lig));
					codes.splice(i, n, codes.slice(i, i + n).join(""));
					done = true;
				}
				if (done) break;
			}
		}
	}
};

const shape = (s: Shaper, text: string, liga: boolean) => {
	const glyphs: number[] = [];
	const codes: string[] = [];
	for (const char of text) {
		glyphs.push(s.face.glyphs.get(char.codePointAt(0) as number) ?? 0);
		codes.push(char);
	}
	if (liga) ligate(s, glyphs, codes);
	const kerns = glyphs.map(() => 0);
	const v = s.face.view;
	for (const subtables of s.kern)
		for (let i = 0; i + 1 < glyphs.length; i++)
			for (const sub of subtables) {
				const value = pair(v, sub, glyphs[i], glyphs[i + 1]);
				if (value === undefined) continue;
				kerns[i] += value;
				break;
			}
	return { glyphs, codes, kerns };
};

const num = (v: number) => String(Math.round(v * 100) / 100);

const colour = (hex: string) =>
	[1, 3, 5]
		.map((k) => Number.parseInt(hex.slice(k, k + 2), 16) / 255)
		.map((x) => x.toFixed(4).replace(/\.?0+$/, "") || "0")
		.join(" ");

const hex4 = (n: number) => n.toString(16).padStart(4, "0").toUpperCase();

const utf16 = (text: string) => {
	let out = "";
	for (let k = 0; k < text.length; k++) out += hex4(text.charCodeAt(k));
	return out;
};

const literal = (text: string) =>
	`(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;

const cmap = (glyphs: number[], map: Map<number, string>) => {
	const entries = glyphs.map(
		(g) => `<${hex4(g)}> <${utf16(map.get(g) as string)}>`,
	);
	const blocks: string[] = [];
	for (let k = 0; k < entries.length; k += 100) {
		const part = entries.slice(k, k + 100);
		blocks.push(`${part.length} beginbfchar\n${part.join("\n")}\nendbfchar`);
	}
	return `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${blocks.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
};

const kappa = 0.5522847498307936;

const deflate = async (data: Uint8Array) =>
	new Uint8Array(
		await new Response(
			new Blob([data as BlobPart])
				.stream()
				.pipeThrough(new CompressionStream("deflate")),
		).arrayBuffer(),
	);

export const pdf = async (
	items: Item[],
	width: number,
	height: number,
	fonts: Map<string, ArrayBuffer>,
	flags: Map<string, Raster>,
	info: { title: string; author: string },
) => {
	const ops: string[] = [`0.75 0 0 -0.75 0 ${num(height * 0.75)} cm`];
	const used = new Map<
		string,
		{ id: string; s: Shaper; text: Map<number, string>; font: Font }
	>();
	const notos = new Map<
		string,
		{
			id: string;
			noto: Weighted;
			text: Map<number, string>;
			glyphs: Set<number>;
			codes: Set<number>;
		}
	>();
	const alphas = new Map<number, string>();
	const images = new Map<string, string>();
	const links: { href: string; box: number[] }[] = [];
	const state = {
		fill: "",
		stroke: "",
		width: -1,
		alpha: 1,
		dash: "",
		join: 0,
	};
	const fill = (c: string) => {
		if (state.fill !== c) ops.push(`${colour(c)} rg`);
		state.fill = c;
	};
	const stroke = (c: string) => {
		if (state.stroke !== c) ops.push(`${colour(c)} RG`);
		state.stroke = c;
	};
	const lineWidth = (w: number) => {
		if (state.width !== w) ops.push(`${num(w)} w`);
		state.width = w;
	};
	const join = (j: number) => {
		if (state.join !== j) ops.push(`${j} j`);
		state.join = j;
	};
	const dash = (d: string) => {
		if (state.dash !== d)
			ops.push(`[${d.split(/[ ,]+/).filter(Boolean).join(" ")}] 0 d`);
		state.dash = d;
	};
	const alpha = (a: number) => {
		if (state.alpha === a) return;
		let name = alphas.get(a);
		if (!name) {
			name = `A${alphas.size}`;
			alphas.set(a, name);
		}
		ops.push(`/${name} gs`);
		state.alpha = a;
	};
	const typeface = (item: Text) => {
		const font = fontOf(item.family, item.weight);
		const key = `${font.family}${font.weight}`;
		let got = used.get(key);
		if (!got) {
			got = { id: `F${used.size}`, s: shaper(font), text: new Map(), font };
			used.set(key, got);
		}
		return got;
	};
	const measure = (item: Text) => {
		const f = typeface(item);
		const shaped = shape(f.s, item.text, !item.track);
		let units = 0;
		shaped.glyphs.forEach((g, k) => {
			units += f.s.face.width(g) + shaped.kerns[k];
		});
		const w =
			(units / f.s.face.em) * item.size + item.track * shaped.glyphs.length;
		return { f, shaped, w };
	};
	const mixed = (item: Text, pieces: Piece[], bounds?: number[]) => {
		const parts = pieces.map((piece) => {
			if (!piece.noto || !piece.shape) {
				const f = typeface(item);
				const shaped = shape(f.s, piece.text, !item.track);
				let units = 0;
				shaped.glyphs.forEach((g, k) => {
					units += f.s.face.width(g) + shaped.kerns[k];
				});
				const w =
					(units / f.s.face.em) * item.size + item.track * shaped.glyphs.length;
				return { piece, f, shaped, w };
			}
			let n = notos.get(piece.noto.file);
			if (!n) {
				n = {
					id: `N${notos.size}`,
					noto: piece.noto,
					text: new Map(),
					glyphs: new Set(),
					codes: new Set(),
				};
				notos.set(piece.noto.file, n);
			}
			characters(piece, n.codes);
			const w =
				(piece.shape.width / piece.noto.face.em) * item.size +
				item.track * piece.shape.glyphs.length;
			return { piece, n, w };
		});
		const total = parts.reduce((a, p) => a + p.w, 0);
		const shift =
			item.anchor === "end"
				? -total
				: item.anchor === "middle"
					? -total / 2
					: 0;
		const angle = ((item.rotate ?? 0) * Math.PI) / 180;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const x = item.x + cos * shift;
		const y = item.y + sin * shift;
		const at = (u: number, v: number) =>
			`${num(cos)} ${num(sin)} ${num(sin)} ${num(-cos)} ${num(x + cos * u + sin * v)} ${num(y + sin * u - cos * v)} Tm`;
		const rtl = pieces.some((piece) => piece.rtl);
		const body: string[] = [];
		const halo: string[] = [];
		const later: string[] = [];
		const push = (show: string, logical?: string) => {
			halo.push(show);
			body.push(
				logical === undefined
					? show
					: `/Span << /ActualText <FEFF${utf16(logical)}> >> BDC ${show} EMC`,
			);
		};
		let pen = 0;
		for (const part of parts) {
			if ("f" in part && part.f) {
				const { f, shaped, piece } = part;
				const head = `/${f.id} ${num(item.size)} Tf ${num(item.track)} Tc`;
				if (piece.rtl) {
					push(head);
					const scale = item.size / f.s.face.em;
					let advance = 0;
					shaped.glyphs.forEach((g, k) => {
						const code = shaped.codes[k];
						if (!f.text.has(g)) f.text.set(g, code);
						const logical = [...code]
							.map((c) =>
								String.fromCodePoint(mirror(c.codePointAt(0) as number)),
							)
							.join("");
						push(
							`${at(pen + advance * scale, 0)} <${hex4(g)}> Tj`,
							logical === code ? undefined : logical,
						);
						advance += f.s.face.width(g) + shaped.kerns[k] + item.track / scale;
					});
				} else {
					const runs: string[] = [];
					let run = "";
					shaped.glyphs.forEach((g, k) => {
						run += hex4(g);
						if (!f.text.has(g)) f.text.set(g, shaped.codes[k]);
						const adjust = shaped.kerns[k];
						if (adjust && k + 1 < shaped.glyphs.length) {
							runs.push(`<${run}>`, num((-adjust * 1000) / f.s.face.em));
							run = "";
						}
					});
					if (run) runs.push(`<${run}>`);
					push(`${head} ${at(pen, 0)} [${runs.join(" ")}] TJ`);
				}
			} else if ("n" in part && part.n) {
				const { n, piece } = part;
				const s = piece.shape as Shape;
				const scale = item.size / n.noto.face.em;
				const head = `/${n.id} ${num(item.size)} Tf ${num(item.track)} Tc`;
				const shows: string[] = [];
				let advance = 0;
				s.glyphs.forEach((g, k) => {
					n.glyphs.add(g);
					shows.push(
						`${at(pen + (advance + s.dx[k]) * scale, s.dy[k] * scale)} <${hex4(g)}> Tj`,
					);
					advance += s.advances[k] + item.track / scale;
				});
				const starts = [...new Set(s.clusters)].sort((a, b) => a - b);
				const members = new Map<number, number[]>();
				s.clusters.forEach((c, k) => {
					const list = members.get(c);
					if (list) list.push(k);
					else members.set(c, [k]);
				});
				halo.push(head, ...shows);
				if (!rtl) body.push(head, ...shows);
				for (const [c, list] of members) {
					const base = list.reduce(
						(b, k) => (s.advances[k] > s.advances[b] ? k : b),
						list[0],
					);
					const next = starts.find((v) => v > c) ?? piece.text.length;
					const cluster = piece.text.slice(c, next);
					const said = piece.rtl ? [...cluster].reverse().join("") : cluster;
					if (!n.text.has(s.glyphs[base])) n.text.set(s.glyphs[base], said);
					if (!rtl) continue;
					body.push(
						`${head} /Span << /ActualText <FEFF${utf16(said)}> >> BDC ${shows[base]} EMC`,
					);
					for (const k of list)
						if (k !== base) later.push(`${head} ${shows[k]}`);
				}
			}
			pen += part.w;
		}
		alpha(1);
		if (item.halo) {
			stroke("#ffffff");
			lineWidth(item.halo);
			join(1);
			ops.push(
				`/Artifact BMC /Span << /ActualText <FEFF> >> BDC BT 1 Tr ${halo.join(" ")} ET EMC EMC`,
			);
		}
		fill(item.fill);
		if (later.length)
			body.push(
				`/Artifact BMC /Span << /ActualText <FEFF> >> BDC ${later.join(" ")} EMC EMC`,
			);
		ops.push(
			rtl
				? `BT 0 Tr ${body.join(" ")} ET`
				: `/Span << /ActualText <FEFF${utf16(item.text)}> >> BDC BT 0 Tr ${body.join(" ")} ET EMC`,
		);
		if (bounds) {
			const top = item.size * 0.8;
			const bottom = item.size * 0.25;
			bounds.push(x, y - top, x + total, y + bottom);
		}
	};
	const text = (item: Text, bounds?: number[]) => {
		const pieces = lay(item.text, fontOf(item.family, item.weight));
		if (pieces) {
			mixed(item, pieces, bounds);
			return;
		}
		const { f, shaped, w } = measure(item);
		const shift =
			item.anchor === "end" ? -w : item.anchor === "middle" ? -w / 2 : 0;
		const angle = ((item.rotate ?? 0) * Math.PI) / 180;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const x = item.x + cos * shift;
		const y = item.y + sin * shift;
		const runs: string[] = [];
		let run = "";
		shaped.glyphs.forEach((g, k) => {
			run += hex4(g);
			if (!f.text.has(g)) f.text.set(g, shaped.codes[k]);
			const adjust = shaped.kerns[k];
			if (adjust && k + 1 < shaped.glyphs.length) {
				runs.push(`<${run}>`, num((-adjust * 1000) / f.s.face.em));
				run = "";
			}
		});
		if (run) runs.push(`<${run}>`);
		const matrix = `${num(cos)} ${num(sin)} ${num(sin)} ${num(-cos)} ${num(x)} ${num(y)} Tm`;
		const head = `/${f.id} ${num(item.size)} Tf ${num(item.track)} Tc ${matrix}`;
		const open = item.track
			? `/Span << /ActualText <FEFF${utf16(item.text)}> >> BDC `
			: "";
		const close = item.track ? " EMC" : "";
		alpha(1);
		if (item.halo) {
			stroke("#ffffff");
			lineWidth(item.halo);
			join(1);
			ops.push(
				`/Artifact BMC /Span << /ActualText <FEFF> >> BDC BT 1 Tr ${head} [${runs.join(" ")}] TJ ET EMC EMC`,
			);
		}
		fill(item.fill);
		ops.push(`${open}BT 0 Tr ${head} [${runs.join(" ")}] TJ ET${close}`);
		if (bounds) {
			const top = item.size * 0.8;
			const bottom = item.size * 0.25;
			bounds.push(x, y - top, x + w, y + bottom);
		}
	};
	const pathOps = (d: string, bounds?: number[]) => {
		const out: string[] = [];
		let x = 0;
		let y = 0;
		for (const [, cmd, args] of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
			const v = args.trim().split(/[ ,]+/).filter(Boolean).map(Number);
			if (cmd === "Z") {
				out.push("h");
				continue;
			}
			if (cmd === "H") x = v[0];
			else if (cmd === "V") y = v[0];
			else [x, y] = v;
			out.push(`${num(x)} ${num(y)} ${cmd === "M" ? "m" : "l"}`);
			bounds?.push(x, y, x, y);
		}
		return out.join(" ");
	};
	const draw = (list: Item[], bounds?: number[]) => {
		for (const item of list) {
			if (item.kind === "rect") {
				const shape = `${num(item.x)} ${num(item.y)} ${num(item.w)} ${num(item.h)} re`;
				const filled = item.fill !== "none";
				if (filled) {
					fill(item.fill);
					alpha(item.opacity ?? 1);
				}
				if (item.stroke && item.sw) {
					if (!filled) alpha(1);
					stroke(item.stroke);
					lineWidth(item.sw);
					join(0);
					ops.push(`${shape} ${filled ? "B" : "S"}`);
				} else if (filled) ops.push(`${shape} f`);
				bounds?.push(item.x, item.y, item.x + item.w, item.y + item.h);
			} else if (item.kind === "text") text(item, bounds);
			else if (item.kind === "dots") {
				fill(item.fill);
				alpha(item.opacity);
				if (item.stroke && item.sw) {
					stroke(item.stroke);
					lineWidth(item.sw);
				}
				const paint = item.stroke && item.sw ? "B" : "f";
				for (const [cx, cy, r] of item.dots) {
					const [a, b, c] = [cx, cy, r].map((v) => Number(v.toFixed(1)));
					const k = c * kappa;
					ops.push(
						`${num(a + c)} ${num(b)} m ${num(a + c)} ${num(b + k)} ${num(a + k)} ${num(b + c)} ${num(a)} ${num(b + c)} c ${num(a - k)} ${num(b + c)} ${num(a - c)} ${num(b + k)} ${num(a - c)} ${num(b)} c ${num(a - c)} ${num(b - k)} ${num(a - k)} ${num(b - c)} ${num(a)} ${num(b - c)} c ${num(a + k)} ${num(b - c)} ${num(a + c)} ${num(b - k)} ${num(a + c)} ${num(b)} c ${paint}`,
					);
				}
			} else if (item.kind === "line") {
				alpha(1);
				stroke(item.stroke);
				lineWidth(item.sw);
				dash(item.dash ?? "");
				join(0);
				ops.push(
					`${num(item.x1)} ${num(item.y1)} m ${num(item.x2)} ${num(item.y2)} l S`,
				);
				dash("");
			} else if (item.kind === "path") {
				const shape = pathOps(item.d, bounds);
				if (!shape) continue;
				const filled = item.fill !== "none";
				if (filled) {
					fill(item.fill);
					alpha(item.opacity ?? 1);
				} else alpha(1);
				join(1);
				if (item.stroke && item.sw) {
					stroke(item.stroke);
					lineWidth(item.sw);
					ops.push(`${shape} ${filled ? "B" : "S"}`);
				} else if (filled) ops.push(`${shape} f`);
			} else if (item.kind === "flag") {
				const raster = flags.get(item.code);
				if (!raster) continue;
				let name = images.get(item.code);
				if (!name) {
					name = `I${images.size}`;
					images.set(item.code, name);
				}
				const h = item.w * 0.75;
				alpha(1);
				ops.push(
					`q ${num(item.w)} 0 0 ${num(-h)} ${num(item.x)} ${num(item.y + h)} cm /${name} Do Q`,
				);
				stroke(frame);
				lineWidth(1);
				join(0);
				ops.push(
					`${num(item.x + 0.5)} ${num(item.y + 0.5)} ${num(item.w - 1)} ${num(h - 1)} re S`,
				);
			} else if (item.kind === "link") {
				const box: number[] = [];
				draw(item.items, box);
				const xs = box.filter((_, k) => k % 2 === 0);
				const ys = box.filter((_, k) => k % 2 === 1);
				if (xs.length)
					links.push({
						href: item.href,
						box: [
							Math.min(...xs),
							Math.min(...ys),
							Math.max(...xs),
							Math.max(...ys),
						],
					});
				bounds?.push(...box);
			}
		}
	};
	draw(items);
	const content = ops.join("\n");

	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	const offsets: number[] = [];
	let length = 0;
	const write = (part: string | Uint8Array) => {
		const bytes = typeof part === "string" ? encoder.encode(part) : part;
		chunks.push(bytes);
		length += bytes.length;
	};
	let count = 0;
	const reserve = () => ++count;
	const object = (id: number, body: string) => {
		offsets[id] = length;
		write(`${id} 0 obj\n${body}\nendobj\n`);
	};
	const stream = async (id: number, dict: string, data: Uint8Array) => {
		const packed = await deflate(data);
		offsets[id] = length;
		write(
			`${id} 0 obj\n<< ${dict} /Length ${packed.length} /Filter /FlateDecode >>\nstream\n`,
		);
		write(packed);
		write("\nendstream\nendobj\n");
	};

	write("%PDF-1.7\n%âãÏÓ\n");
	const catalog = reserve();
	const pages = reserve();
	const page = reserve();
	const contents = reserve();
	const fontRefs: string[] = [];
	const fontObjects: (() => Promise<void>)[] = [];
	for (const { id, s, text: map, font } of used.values()) {
		const type0 = reserve();
		const cid = reserve();
		const descriptor = reserve();
		const file = reserve();
		const unicode = reserve();
		fontRefs.push(`/${id} ${type0} 0 R`);
		fontObjects.push(async () => {
			const f = s.face;
			const v = f.view;
			const head = f.tables.get("head") as number;
			const hhea = f.tables.get("hhea") as number;
			const scale = 1000 / f.em;
			const bbox = [36, 38, 40, 42].map((o) =>
				Math.round(v.getInt16(head + o) * scale),
			);
			const glyphs = [...map.keys()].sort((a, b) => a - b);
			const widths: string[] = [];
			for (let k = 0; k < glyphs.length; ) {
				let j = k;
				while (j + 1 < glyphs.length && glyphs[j + 1] === glyphs[j] + 1) j++;
				widths.push(
					`${glyphs[k]} [${glyphs
						.slice(k, j + 1)
						.map((g) => num(f.width(g) * scale))
						.join(" ")}]`,
				);
				k = j + 1;
			}
			object(
				type0,
				`<< /Type /Font /Subtype /Type0 /BaseFont /${s.name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${unicode} 0 R >>`,
			);
			object(
				cid,
				`<< /Type /Font /Subtype /CIDFontType0 /BaseFont /${s.name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 /W [${widths.join(" ")}] >>`,
			);
			object(
				descriptor,
				`<< /Type /FontDescriptor /FontName /${s.name} /Flags 32 /FontBBox [${bbox.join(" ")}] /ItalicAngle 0 /Ascent ${Math.round(v.getInt16(hhea + 4) * scale)} /Descent ${Math.round(v.getInt16(hhea + 6) * scale)} /CapHeight ${Math.round(f.cap * scale)} /StemV ${Math.round(50 + (font.weight - 400) / 4)} /FontFile3 ${file} 0 R >>`,
			);
			await stream(
				file,
				"/Subtype /OpenType",
				new Uint8Array(
					fonts.get(files[`${font.family}${font.weight}`]) as ArrayBuffer,
				),
			);
			await stream(unicode, "", encoder.encode(cmap(glyphs, map)));
		});
	}
	for (const { id, noto, text: map, glyphs: drawn, codes } of notos.values()) {
		const type0 = reserve();
		const cid = reserve();
		const descriptor = reserve();
		const file = reserve();
		const unicode = reserve();
		fontRefs.push(`/${id} ${type0} 0 R`);
		fontObjects.push(async () => {
			const f = noto.face;
			const v = f.view;
			const head = f.tables.get("head") as number;
			const hhea = f.tables.get("hhea") as number;
			const scale = 1000 / f.em;
			const bbox = [36, 38, 40, 42].map((o) =>
				Math.round(v.getInt16(head + o) * scale),
			);
			const glyphs = [...drawn].sort((a, b) => a - b);
			const program = subset(noto, drawn, codes);
			const tag = [...crc32(program).toString(26).padStart(6, "0").slice(-6)]
				.map((c) => String.fromCharCode(65 + Number.parseInt(c, 26)))
				.join("");
			const name = `${tag}+${nameOf(f)}`;
			const widths: string[] = [];
			for (let k = 0; k < glyphs.length; ) {
				let j = k;
				while (j + 1 < glyphs.length && glyphs[j + 1] === glyphs[j] + 1) j++;
				widths.push(
					`${glyphs[k]} [${glyphs
						.slice(k, j + 1)
						.map((g) => num(f.width(g) * scale))
						.join(" ")}]`,
				);
				k = j + 1;
			}
			object(
				type0,
				`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${unicode} 0 R >>`,
			);
			object(
				cid,
				`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 /W [${widths.join(" ")}] /CIDToGIDMap /Identity >>`,
			);
			object(
				descriptor,
				`<< /Type /FontDescriptor /FontName /${name} /Flags 4 /FontBBox [${bbox.join(" ")}] /ItalicAngle 0 /Ascent ${Math.round(v.getInt16(hhea + 4) * scale)} /Descent ${Math.round(v.getInt16(hhea + 6) * scale)} /CapHeight ${Math.round(f.cap * scale)} /StemV ${Math.round(50 + (noto.weight - 400) / 4)} /FontFile2 ${file} 0 R >>`,
			);
			await stream(file, `/Length1 ${program.length}`, program);
			await stream(
				unicode,
				"",
				encoder.encode(
					cmap(
						[...map.keys()].sort((a, b) => a - b),
						map,
					),
				),
			);
		});
	}
	const imageRefs: string[] = [];
	const imageObjects: (() => Promise<void>)[] = [];
	for (const [code, name] of images) {
		const raster = flags.get(code) as Raster;
		const id = reserve();
		const n = raster.width * raster.height;
		const rgb = new Uint8Array(n * 3);
		const mask = new Uint8Array(n);
		let opaque = true;
		for (let k = 0; k < n; k++) {
			rgb[3 * k] = raster.rgba[4 * k];
			rgb[3 * k + 1] = raster.rgba[4 * k + 1];
			rgb[3 * k + 2] = raster.rgba[4 * k + 2];
			mask[k] = raster.rgba[4 * k + 3];
			if (mask[k] !== 255) opaque = false;
		}
		const soft = opaque ? 0 : reserve();
		imageRefs.push(`/${name} ${id} 0 R`);
		const dims = `/Width ${raster.width} /Height ${raster.height} /BitsPerComponent 8`;
		imageObjects.push(async () => {
			await stream(
				id,
				`/Type /XObject /Subtype /Image ${dims} /ColorSpace /DeviceRGB${soft ? ` /SMask ${soft} 0 R` : ""}`,
				rgb,
			);
			if (soft)
				await stream(
					soft,
					`/Type /XObject /Subtype /Image ${dims} /ColorSpace /DeviceGray`,
					mask,
				);
		});
	}
	const annots = links.map(() => reserve());
	const meta = reserve();
	object(catalog, `<< /Type /Catalog /Pages ${pages} 0 R >>`);
	object(pages, `<< /Type /Pages /Kids [${page} 0 R] /Count 1 >>`);
	const states = [...alphas].map(([a, name]) => `/${name} << /ca ${num(a)} >>`);
	object(
		page,
		`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${num(width * 0.75)} ${num(height * 0.75)}] /Resources << /Font << ${fontRefs.join(" ")} >> /ExtGState << ${states.join(" ")} >> /XObject << ${imageRefs.join(" ")} >> >> /Contents ${contents} 0 R /Annots [${annots.map((id) => `${id} 0 R`).join(" ")}] >>`,
	);
	await stream(contents, "", encoder.encode(content));
	for (const make of fontObjects) await make();
	for (const make of imageObjects) await make();
	links.forEach(({ href, box }, k) => {
		const [x0, y0, x1, y1] = box;
		const rect = [
			x0 * 0.75,
			(height - y1) * 0.75,
			x1 * 0.75,
			(height - y0) * 0.75,
		].map(num);
		object(
			annots[k],
			`<< /Type /Annot /Subtype /Link /Rect [${rect.join(" ")}] /Border [0 0 0] /A << /S /URI /URI ${literal(href)} >> >>`,
		);
	});
	object(
		meta,
		`<< /Title <FEFF${utf16(info.title)}> /Author <FEFF${utf16(info.author)}> /Producer <FEFF${utf16("AllRankings")}> >>`,
	);
	const xref = length;
	const rows = ["0000000000 65535 f "];
	for (let id = 1; id <= count; id++)
		rows.push(`${String(offsets[id]).padStart(10, "0")} 00000 n `);
	write(
		`xref\n0 ${count + 1}\n${rows.join("\n")}\ntrailer\n<< /Size ${count + 1} /Root ${catalog} 0 R /Info ${meta} 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
	);
	const out = new Uint8Array(length);
	let at = 0;
	for (const c of chunks) {
		out.set(c, at);
		at += c.length;
	}
	return out;
};
