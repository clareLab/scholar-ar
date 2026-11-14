import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, type Plugin } from "vite";
import { about } from "./src/about/vite.ts";

type Package = { name: string; version: string; license?: string; dir: string };

const workers = new Map<string, Package>();

const owner = (id: string): Package | undefined => {
	for (let dir = dirname(id); dir.includes("node_modules"); dir = dirname(dir))
		try {
			const data = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
			if (data.name && data.version) return { ...data, dir };
		} catch {}
	return undefined;
};

const gather = (): Plugin => ({
	name: "worker-licenses",
	generateBundle(_, bundle) {
		for (const chunk of Object.values(bundle))
			if (chunk.type === "chunk")
				for (const id of chunk.moduleIds) {
					const found = owner(id);
					if (found) workers.set(`${found.name} - ${found.version}`, found);
				}
	},
});

const harfbuzz = fileURLToPath(new URL("harfbuzz.txt", import.meta.url));

const licenses = (): Plugin => ({
	name: "licenses",
	generateBundle: {
		order: "post",
		handler(_, bundle) {
			const file = bundle["licenses.md"];
			if (file?.type !== "asset") return;
			let text = String(file.source);
			for (const [key, { license, dir }] of workers) {
				if (text.includes(`## ${key}`)) continue;
				const notice = readdirSync(dir).find((f) =>
					/^(licen[cs]e|copying)/i.test(f),
				);
				text += `\n## ${key}${license ? ` (${license})` : ""}\n`;
				if (notice)
					text += `\n${readFileSync(join(dir, notice), "utf8").trim()}\n`;
			}
			if (text.includes("\n## harfbuzzjs - "))
				text += `\n## harfbuzz - 15.0.0 (MIT-Modern-Variant AND MIT)\n\n${readFileSync(harfbuzz, "utf8").trim()}\n`;
			file.source = text;
		},
	},
});

export default defineConfig({
	base: "/",
	build: { license: { fileName: "licenses.md" }, manifest: true },
	plugins: [about(), svelte(), licenses()],
	worker: { format: "es", plugins: () => [about(), gather()] },
});
