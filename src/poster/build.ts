import { type Flag, slice, used, weight } from "./band";
import { compose, page } from "./compose";
import { embedded, families, fontOf, load } from "./fonts";
import type { Meta } from "./masthead";
import { type Data, derive } from "./model";
import {
	characters,
	lay,
	supplied as named,
	prepare,
	subset,
	type Weighted,
} from "./noto";
import type { Item } from "./scene";
import { face, svg } from "./svg";

export const base64 = (bytes: Uint8Array) => {
	let out = "";
	for (let k = 0; k < bytes.length; k += 32768)
		out += String.fromCharCode(...bytes.subarray(k, k + 32768));
	return btoa(out);
};

export const build = async (
	data: Data,
	meta: Meta,
	font: (file: string) => Promise<ArrayBuffer>,
	flag: (code: string) => Promise<ArrayBuffer | undefined>,
	now: (file: string) => ArrayBuffer,
) => {
	const fonts = await load(font);
	await prepare(
		{ ...data, venues: data.venues.slice(0, derive(data).venueCut.end) },
		font,
		now,
	);
	const { scene } = compose(data, meta);
	const flags = new Map<string, string>();
	for (const code of [...scene.flags].sort()) {
		const bytes = await flag(code);
		if (bytes)
			flags.set(
				code,
				`data:image/svg+xml;base64,${base64(new Uint8Array(bytes))}`,
			);
	}
	const supplied = new Map<
		string,
		{
			name: string;
			weight: number;
			noto: Weighted;
			glyphs: Set<number>;
			codes: Set<number>;
		}
	>();
	const collect = (items: Item[]) => {
		for (const item of items) {
			if (item.kind === "link") collect(item.items);
			if (item.kind !== "text") continue;
			for (const piece of lay(item.text, fontOf(item.family, item.weight)) ??
				[]) {
				if (!piece.noto || !piece.shape) continue;
				const name = piece.name as string;
				const key = `${name}${item.weight}`;
				let got = supplied.get(key);
				if (!got) {
					got = {
						name,
						weight: item.weight,
						noto: piece.noto,
						glyphs: new Set(),
						codes: new Set(),
					};
					supplied.set(key, got);
				}
				for (const g of piece.shape.glyphs) got.glyphs.add(g);
				characters(piece, got.codes);
			}
		}
	};
	collect(scene.items);
	const supplements = [...supplied].map(
		([key, { name, weight, noto, glyphs, codes }]) => ({
			key,
			name,
			weight,
			bytes: subset(noto, glyphs, codes),
		}),
	);
	const faces = [
		...embedded.map(([family, weight, file]) => ({
			key: `${family === "IBM Plex Sans" ? families.sans : families.cond}${weight}`,
			css: face(
				family,
				weight,
				base64(new Uint8Array(fonts.get(file) as ArrayBuffer)),
			),
		})),
		...supplements.map(({ key, name, weight, bytes }) => ({
			key,
			css: face(name, weight, base64(bytes), "ttf"),
		})),
	];
	const family = (item: Extract<Item, { kind: "text" }>) => {
		const more = named(item.text, fontOf(item.family, item.weight));
		if (!more.length) return item.family;
		const [first, ...rest] = item.family.split(", ");
		return [first, ...more.map((name) => `'${name}'`), ...rest].join(", ");
	};
	const bands = (
		rows: number,
		budget: number,
		inline = new Map<string, string>(),
	) => {
		const out: { height: number; svg: string; flags: Flag[] }[] = [];
		for (let top = 0; top < page.height; ) {
			let height = Math.min(rows, page.height - top);
			let items = slice(scene.items, top, top + height);
			while (height > 1 && weight(items) > budget) {
				height >>= 1;
				items = slice(scene.items, top, top + height);
			}
			const { flags: marks, faces: keys } = used(items);
			out.push({
				height,
				svg: svg(
					items,
					page.width,
					height,
					inline,
					faces.filter((f) => keys.has(f.key)).map((f) => f.css),
					top,
					family,
				),
				flags: marks
					.filter((mark) => flags.has(mark.code))
					.map((mark) => ({ ...mark, y: mark.y - top })),
			});
			top += height;
		}
		return out;
	};
	return {
		scene,
		fonts,
		flags,
		supplements,
		bands,
		svg: svg(
			scene.items,
			page.width,
			page.height,
			flags,
			faces.map((f) => f.css),
			0,
			family,
		),
	};
};
