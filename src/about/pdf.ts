import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { plugin } from "bun";
import type { Component } from "svelte";
import { compile } from "svelte/compiler";
import { render } from "svelte/server";
import type { Props } from "./plot";
import { type About, resolve } from "./resolve";
import { langs, words } from "./words";

plugin({
	name: "svelte",
	setup(build) {
		build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
			contents: compile(await Bun.file(path).text(), {
				filename: path,
				generate: "server",
			}).js.code,
			loader: "js",
		}));
	},
});

const here = import.meta.dir;
const site = `${here}/../..`;
const [source] = process.argv.slice(2);
if (!source) throw new Error("usage: pdf.ts <about.json>");

const about: About = await Bun.file(source).json();

const make = async (lang: (typeof langs)[number]) => {
	const say = words[lang];
	const file = lang === "en" ? "about.md" : `about.${lang}.md`;
	const text = resolve(await Bun.file(`${here}/${file}`).text(), about, lang, {
		year: new Date().getFullYear(),
	});
	const work = await mkdtemp(`${tmpdir()}/about-`);
	const run = async (cmd: string[]) => {
		const proc = Bun.spawn(cmd, {
			cwd: work,
			stdout: "inherit",
			stderr: "inherit",
		});
		if ((await proc.exited) !== 0) throw new Error(cmd.join(" "));
	};
	try {
		for (const [, id] of text.matchAll(
			/^::: \{#fig:([a-z]+) \.figure( \.wide)?\}$/gm,
		)) {
			const figure: { default: Component<Props> } = await import(
				`${here}/figures/${id}.svelte`
			);
			const { body } = render(figure.default, {
				props: { about, words: say, print: true },
			});
			const svg = body.match(/<svg[\s\S]*<\/svg>/)?.[0];
			if (!svg) throw new Error(`no svg: ${id}`);
			await Bun.write(`${work}/${id}.svg`, svg.replace(/<!--[^>]*-->/g, ""));
			await run(["rsvg-convert", "-f", "pdf", "-o", `${id}.pdf`, `${id}.svg`]);
		}
		await Bun.write(`${work}/paper.md`, text);
		await run([
			"pandoc",
			"paper.md",
			"--from=markdown",
			"--to=latex",
			"--number-sections",
			`--template=${here}/paper.tex`,
			`--lua-filter=${here}/paper.lua`,
			`--metadata=date:${say.date(new Date())}`,
			`--metadata=release:${say.release(about.release)}`,
			`--metadata=figure:${say.figure}`,
			`--metadata=abstractname:${say.abstract}`,
			`--metadata=refname:${say.references}`,
			...(say.cjk ? ["--metadata=cjk:true"] : []),
			"--output=paper.tex",
		]);
		await run(["tectonic", "--chatter=minimal", "paper.tex"]);
		await Bun.write(`${site}/public/${say.pdf}`, Bun.file(`${work}/paper.pdf`));
	} finally {
		await rm(work, { recursive: true, force: true });
	}
};

for (const lang of langs) await make(lang);
await Bun.write(`${site}/public/about.json`, JSON.stringify(about));
