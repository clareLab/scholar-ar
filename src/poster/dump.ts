const [root, out, view = "0", search = ""] = process.argv.slice(2);

const server = Bun.serve({
	port: 0,
	fetch: async (request) => {
		const file = Bun.file(`${root}${new URL(request.url).pathname}`);
		if (!(await file.exists())) return new Response(null, { status: 404 });
		const range = request.headers.get("Range")?.match(/^bytes=(\d+)-(\d+)$/);
		if (!range) return new Response(file);
		const from = Number(range[1]);
		const to = Math.min(Number(range[2]), file.size - 1);
		return new Response(file.slice(from, to + 1), {
			status: 206,
			headers: { "Content-Range": `bytes ${from}-${to}/${file.size}` },
		});
	},
});

process.env.VITE_API = server.url.href.replace(/\/$/, "");

const site = await import("../data");
const { lands, poster } = await import("./data");

const meta = await site.load();
const q = new URLSearchParams(search);
const list = (key: string) => (q.get(key) ?? "").split(",").filter(Boolean);
const int = (key: string, or: number) => {
	const value = Number(q.get(key) ?? Number.NaN);
	return Number.isInteger(value) ? value : or;
};
const clamp = (year: number) =>
	Math.min(Math.max(year, site.years[0]), site.years[1]);
const from = clamp(int("from", site.defaults[0]));
const codes = lands(meta);
const data = await poster(meta, {
	view: Number(view),
	from,
	to: Math.max(clamp(int("to", site.defaults[1])), from),
	tiers: [1, 2, 3, 4].filter((t) => (q.get("tiers") ?? "1").includes(`${t}`)),
	flip: list("flip").filter((key) => /^[1-4]\.\d+$/.test(key)),
	off: list("off")
		.map(Number)
		.sort((a, b) => a - b),
	at: q.has("in") ? codes.filter((code) => list("in").includes(code)) : codes,
});

await Bun.write(out, JSON.stringify(data));
server.stop();

export {};
