import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { build } from "vite";
import type { Meta } from "./src/data";

const [data, work, part, parts] = process.argv.slice(2);
if (!data) throw new Error("usage: prerender.ts <release>");

const site = import.meta.dir;
const dist = `${site}/dist`;
const workers = 4;

const write = (path: string, html: string) =>
	Bun.write(`${dist}${path}${path.endsWith("/") ? "index.html" : ""}`, html);

const views = (nodes: Meta["nodes"]) =>
	[...nodes.values()]
		.map((node) => ({ node, base: `views/${node.level}/${node.id}` }))
		.filter(({ base }) => existsSync(`${data}/${base}`));

const paths = (id: number) =>
	["institutions", "venues"].map((tab) => `/${id ? `${id}/` : ""}${tab}/`);

const offline = (api: string) => {
	const local = async (input: string | URL | Request, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : `${input}`;
		if (!url.startsWith(`${api}/`)) throw new Error(`offline: ${url}`);
		const file = Bun.file(`${data}/${url.slice(api.length + 1)}`);
		if (!(await file.exists())) return new Response(null, { status: 404 });
		const range = new Headers(init?.headers)
			.get("Range")
			?.match(/^bytes=(\d+)-(\d+)$/);
		if (!range) return new Response(file);
		const from = Number(range[1]);
		const to = Math.min(Number(range[2]), file.size - 1);
		return new Response(file.slice(from, to + 1), {
			status: 206,
			headers: { "Content-Range": `bytes ${from}-${to}/${file.size}` },
		});
	};
	globalThis.fetch = Object.assign(local, { preconnect: fetch.preconnect });
};

const open = async (work: string) => {
	const app: typeof import("./src/static") = await import(`${work}/static.js`);
	offline(app.api);
	return { app, meta: await app.load() };
};

const render = async () => {
	const { app, meta } = await open(work as string);
	const shell = await Bun.file(`${dist}/index.html`).text();
	const manifest = await Bun.file(`${dist}/.vite/manifest.json`).json();
	const styles = (manifest["src/about/About.svelte"]?.css ?? []).map(
		(css: string) => `<link rel="stylesheet" crossorigin href="/${css}">`,
	);

	const emit = async (path: string) => {
		const { body, head } = await app.draw(meta, path, 64);
		const lines = [
			`<title>${app.quote(head.title)}</title>`,
			...app.tags(head),
			...(head.about ? styles : []),
		];
		await write(
			path,
			shell
				.replace('<html lang="en">', () => `<html lang="${head.lang}">`)
				.replace("<title>AllRankings</title>", () => lines.join("\n    "))
				.replace(
					"<body>",
					() => `<body>${body.replace(/<!--[\s\S]*?-->/g, "")}`,
				),
		);
	};

	const k = Number(part);
	for (const [j, { node, base }] of views(meta.nodes).entries()) {
		if (j % Number(parts) !== k) continue;
		app.forget(base);
		for (const path of paths(node.id)) await emit(path);
	}
	if (!k) for (const lang of ["en", "zh"]) await emit(`/${lang}/about/`);
};

const main = async () => {
	const started = performance.now();
	const out = await mkdtemp(`${tmpdir()}/prerender-`);
	await build({
		root: site,
		logLevel: "warn",
		ssr: { noExternal: true },
		build: {
			ssr: "src/static.ts",
			outDir: out,
			emptyOutDir: true,
			copyPublicDir: false,
			manifest: false,
			license: false,
		},
	});
	const { app, meta } = await open(out);
	const pages = [
		...views(meta.nodes).flatMap(({ node }) => paths(node.id)),
		"/en/about/",
		"/zh/about/",
	];
	const runs = Array.from({ length: workers }, (_, k) =>
		Bun.spawn(
			[process.execPath, import.meta.path, data, out, `${k}`, `${workers}`],
			{ stdout: "inherit", stderr: "inherit" },
		),
	);
	for (const run of runs)
		if ((await run.exited) !== 0) throw new Error("prerender worker failed");
	for (const path of pages)
		if (!existsSync(`${dist}${path}index.html`)) throw new Error(path);

	const shell = await Bun.file(`${dist}/index.html`).text();
	await write(
		"/404.html",
		shell.replace('<html lang="en">', '<html lang="en" data-missing>'),
	);
	await write(
		"/index.html",
		`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>AllRankings</title>
    <link rel="canonical" href="${app.origin}/institutions/" />
    <meta http-equiv="refresh" content="0; url=/institutions/" />
    <script>
      location.replace("/institutions/");
    </script>
  </head>
</html>
`,
	);
	await write(
		"/sitemap.xml",
		`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((path) => `  <url><loc>${app.origin}${path}</loc></url>`).join("\n")}
</urlset>
`,
	);
	await rm(`${dist}/.vite`, { recursive: true, force: true });
	await rm(out, { recursive: true, force: true });
	console.log(
		`${pages.length} pages in ${((performance.now() - started) / 1000).toFixed(1)} s`,
	);
};

await (work ? render() : main());
