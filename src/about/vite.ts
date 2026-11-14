import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { paper } from "./render.ts";
import { resolve } from "./resolve.ts";
import { sentence } from "./sentence.ts";
import { type Lang, words } from "./words/index.ts";

const data = "\0about-data";
const snapshot = "virtual:snapshot";
const years = "virtual:years";

export const about = (): Plugin => {
	const path = fileURLToPath(
		new URL("../../public/about.json", import.meta.url),
	);
	const read = async () =>
		existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : undefined;
	return {
		name: "about",
		resolveId: (id) =>
			id === data
				? id
				: id === snapshot || id === years
					? `\0${id}`
					: undefined,
		async load(id) {
			if (![data, `\0${snapshot}`, `\0${years}`].includes(id)) return;
			this.addWatchFile(path);
			const json = await read();
			if (id === data) return `export default ${JSON.stringify(json)}`;
			if (id === `\0${years}`) {
				if (!json?.years || !json?.default_years)
					throw new Error(`no years in ${path}`);
				return `export const years = ${JSON.stringify(json.years)};\nexport const defaults = ${JSON.stringify(json.default_years)};`;
			}
			return `export default ${JSON.stringify(json?.snapshot ?? "")}`;
		},
		async transform(text, id) {
			const match = id.match(/\/about\/about(?:\.(\w+))?\.md(\?lead)?$/);
			const lang = (match?.[1] ?? "en") as Lang;
			if (!match || !(lang in words)) return;
			this.addWatchFile(path);
			const json = await read();
			if (!json) return "export default undefined";
			const built = paper(
				resolve(text, json, lang, { year: new Date().getFullYear() }),
				words[lang],
			);
			if (match[2])
				return `export default ${JSON.stringify(sentence(built.abstract))}`;
			return {
				code: `import about from ${JSON.stringify(data)};\nexport default { paper: ${JSON.stringify(built)}, about };`,
				map: null,
			};
		},
	};
};
