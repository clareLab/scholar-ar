import {
	asyncBufferFromFile,
	parquetMetadataAsync,
	parquetReadObjects,
} from "hyparquet";
import { compressors } from "hyparquet-compressors";

const root = process.argv[2];

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

const site = await import("./src/data");

const selections: [number, number, number, number[], boolean, boolean][] = [
	[0, 2022, 2025, [1], false, false],
	[0, 2025, 2025, [1], true, true],
	[2, 2016, 2020, [1, 2], true, false],
	[2, 2024, 2025, [1], false, true],
	[17, 2022, 2025, [1], false, false],
	[17, 2004, 2025, [1], true, false],
	[17, 2010, 2015, [2], false, true],
	[1702, 2020, 2023, [1, 2], true, true],
	[1702, 2022, 2025, [1], false, false],
	[10102, 2004, 2025, [1, 2, 3, 4], true, false],
	[10102, 2022, 2025, [1], true, false],
];

const disk = <T>(path: string): Promise<T> =>
	Bun.file(`${root}/${path}`).json();

const tree = await disk<{
	domains: [number, string][];
	fields: [number, string, number][];
	subfields: [number, string, number][];
	topics: [number, string, number][];
}>("tree.json");
const ids = (await disk<{ id: number[] }>("venues.json")).id;
const size = (await disk<{ id: number[] }>("institutions.json")).id.length;

const up = new Map<number, number>();
for (const rows of [tree.fields, tree.subfields, tree.topics])
	for (const [id, , parent] of rows) up.set(id, parent);
for (const [id] of tree.domains) up.set(id, 0);

const chain = (topic: number) => {
	const out = [topic];
	while (out.length < 5) out.push(up.get(out[out.length - 1]) ?? 0);
	return out;
};

const levels = ["topic", "subfield", "field", "domain", "all"];

const rows = async (path: string, years: Set<number>, columns: string[]) => {
	const file = await asyncBufferFromFile(`${root}/${path}`);
	const metadata = await parquetMetadataAsync(file);
	const out: Record<string, unknown>[] = [];
	let at = 0;
	for (const group of metadata.row_groups) {
		const n = Number(group.num_rows);
		const stat = group.columns.find(
			(c) => c.meta_data?.path_in_schema[0] === "year",
		)?.meta_data?.statistics;
		if (years.has(Number(stat?.min_value)))
			out.push(
				...(await parquetReadObjects({
					file,
					metadata,
					rowStart: at,
					rowEnd: at + n,
					columns,
					compressors,
				})),
			);
		at += n;
	}
	return out;
};

const recount = async (
	view: number,
	level: number,
	years: number[],
	picked: (t: number, v: number) => boolean,
	off: Set<number>,
) => {
	const bucket = new Map<number, number>();
	for (const [topic] of tree.topics) {
		const path = chain(topic);
		if (path[level] !== view) continue;
		const child = level ? path[level - 1] : topic;
		if (!off.has(child)) bucket.set(topic, child);
	}
	const cells = await rows(
		`views/${levels[level]}/${view}/venues.parquet`,
		new Set(years),
		["year", "v", "tier"],
	);
	const wanted = new Map<number, Set<number>>();
	for (const { year, v, tier } of cells)
		if (picked(Number(tier), Number(v)))
			wanted.set(
				Number(v),
				(wanted.get(Number(v)) ?? new Set()).add(Number(year)),
			);
	const sums = new Float64Array(size);
	for (const [v, span] of wanted) {
		const papers = await rows(`venue/${v}.parquet`, span, [
			"year",
			"K",
			"topics",
			"k",
			"i",
			"w",
		]);
		for (const paper of papers) {
			if (!span.has(Number(paper.year))) continue;
			const K = Number(paper.K);
			const parts = new Map<number, number>();
			const topics = paper.topics as number[];
			const k = paper.k as number[];
			topics.forEach((topic, j) => {
				const child = bucket.get(Number(topic));
				if (child !== undefined)
					parts.set(child, (parts.get(child) ?? 0) + Number(k[j]));
			});
			const i = paper.i as number[];
			const w = paper.w as number[];
			for (const kc of parts.values())
				i.forEach((inst, j) => {
					sums[Number(inst)] += Math.round((kc * Number(w[j])) / (K * 1000));
				});
		}
	}
	return sums;
};

const meta = await site.load();
let failed = false;

for (const [view, from, to, tiers, flipping, unchecking] of selections) {
	const node = meta.nodes.get(view);
	if (!node) throw new Error(`view ${view}`);
	const base = `views/${node.level}/${node.id}`;
	site.forget(base);
	const years = Array.from({ length: to - from + 1 }, (_, k) => from + k);
	const chosen = new Set(tiers);
	const cells = await site.stalls(node, years, true);
	const shelf = site.shelve(cells, meta.venues.id);
	const first = (on: boolean) =>
		shelf.listings[[1, 2, 3, 4].findIndex((t) => chosen.has(t) === on)]?.[0]
			?.key;
	const flip = flipping
		? [first(true), first(false)].filter((key) => key !== undefined)
		: [];
	const off = new Set(unchecking ? [node.children[0].id] : []);
	const counts = await site.ends(
		node,
		"counts",
		"n",
		[from, to],
		site.whole(node, off),
		{ tier: tiers },
	);
	const bundles = await Promise.all(
		site
			.swaps(shelf, flip, chosen, years)
			.map(async ({ sign, read }) => ({ sign, files: await read() })),
	);
	const shown = site.count(
		counts,
		bundles,
		site.topics(node, [...off]),
		off,
		size,
	);
	const picked = (t: number, v: number) =>
		chosen.has(t) !== flip.includes(`${t}.${ids[v]}`);
	const truth = await recount(
		view,
		levels.indexOf(node.level),
		years,
		picked,
		off,
	);
	let total = 0;
	let wrong = 0;
	for (let i = 0; i < size; i++) {
		total += truth[i];
		if (shown[i] !== truth[i]) wrong++;
	}
	const label = `${node.level} ${view} ${from}-${to} tiers ${tiers.join("")} flip ${flip.join(",") || "-"} off ${[...off].join(",") || "-"}`;
	console.log(`${label}: total ${total}, mismatches ${wrong}`);
	if (wrong || total <= 0) failed = true;
}

server.stop();
if (failed) process.exit(1);
