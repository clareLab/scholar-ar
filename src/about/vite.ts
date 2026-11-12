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

export const about = (): Plugin => {
	const path = fileURLToPath(
		new URL("../../public/about.json", import.meta.url),
	);
	const read = async () =>
		existsSync(path) ? JSON.parse(await readFile(path, "utf8")) : undefined;
	return {
		name: "about",
		resolveId: (id) =>
			id === data ? id : id === snapshot ? `\0${snapshot}` : undefined,
		async load(id) {
			if (id !== data && id !== `\0${snapshot}`) return;
			this.addWatchFile(path);
			const json = await read();
			if (id === data) return `export default ${JSON.stringify(json)}`;
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
				resolve(text, json, { year: new Date().getFullYear() }),
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
