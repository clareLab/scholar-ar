import { type Flag, slice, used, weight } from "./band";
import { compose, page } from "./compose";
import { embedded, families, load } from "./fonts";
import type { Meta } from "./masthead";
import type { Data } from "./model";
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
) => {
	const fonts = await load(font);
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
	const faces = embedded.map(([family, weight, file]) => ({
		key: `${family === "IBM Plex Sans" ? families.sans : families.cond}${weight}`,
		css: face(
			family,
			weight,
			base64(new Uint8Array(fonts.get(file) as ArrayBuffer)),
		),
	}));
	const bands = (rows: number, budget: number) => {
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
					new Map(),
					faces.filter((f) => keys.has(f.key)).map((f) => f.css),
					top,
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
		bands,
		svg: svg(
			scene.items,
			page.width,
			page.height,
			flags,
			faces.map((f) => f.css),
		),
	};
};
