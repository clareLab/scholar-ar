import { readFileSync } from "node:fs";
import {
	asyncBufferFromFile,
	parquetMetadataAsync,
	parquetReadObjects,
} from "hyparquet";
import { compressors } from "hyparquet-compressors";
import { serve } from "./serve";
import type { Group, Node } from "./src/data";

const [root, aboutPath] = process.argv.slice(2);

const server = await serve(root, aboutPath);

const site = await import("./src/data");
const tables = await import("./src/tables");
const { defaults, years: bounds } = await import("./src/state");

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

const children = (view: number, level: number) => {
	const out = new Map<number, number>();
	for (const [topic] of tree.topics) {
		const path = chain(topic);
		if (path[level] === view) out.set(topic, level ? path[level - 1] : topic);
	}
	return out;
};

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
	const bucket = children(view, level);
	for (const [topic, child] of bucket) if (off.has(child)) bucket.delete(topic);
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

const masses = (
	files: Group[],
	bucket: Map<number, number>,
	split: boolean,
) => {
	const out = new Map<string, number>();
	const add = (key: string, n: number) => out.set(key, (out.get(key) ?? 0) + n);
	for (const { year, K, topics, k } of files)
		for (let r = 0; r < K.length; r++) {
			const parts = new Map<number, number>();
			topics[r].forEach((topic, j) => {
				const child = bucket.get(topic);
				if (child !== undefined)
					parts.set(child, (parts.get(child) ?? 0) + k[r][j]);
			});
			for (const [child, kc] of parts) {
				const n = Math.round((kc * 1e9) / (K[r] * 1000));
				if (split) add(`${year[r]} ${child}`, n);
				add(`${year[r]} 0`, n);
			}
		}
	return out;
};

const same = (a: Map<string, number>, b: Map<string, number>) =>
	a.size === b.size && [...a].every(([key, n]) => b.get(key) === n);

const stored = (groups: Group[], v: number, held: Set<number>) => {
	const out = new Map<string, number>();
	for (const { year, child, v: venue, mass } of groups)
		for (let r = 0; r < venue.length; r++)
			if (venue[r] === v && held.has(year[r]))
				out.set(`${year[r]} ${child?.[r] ?? 0}`, mass[r]);
	return out;
};

const totals = async (node: Node, span: number[], tiers: number[]) => {
	let wrong = 0;
	for (const [file, value, want] of [
		["counts", "n", { tier: tiers }],
		["faculty", "f", {}],
	] as const) {
		const [whole, apart] = await Promise.all(
			[true, false].map((all) => site.ends(node, file, value, span, all, want)),
		);
		for (const k of [0, 1]) {
			const a = site.tally([whole[k], []], size, value, new Set());
			const b = site.tally([apart[k], []], size, value, new Set());
			for (let i = 0; i < size; i++) if (a[i] !== b[i]) wrong++;
		}
	}
	return wrong;
};

const unions = (whole: Group[], apart: Group[]) => {
	let wrong = 0;
	const sum = new Map<string, [number, number, Set<string>]>();
	for (const { year, v, tier, mass, countries } of apart)
		for (let r = 0; r < v.length; r++) {
			const key = `${year[r]} ${v[r]}`;
			const at = sum.get(key) ?? [tier[r], 0, new Set()];
			if (at[0] !== tier[r]) wrong++;
			at[1] += mass[r];
			for (const code of countries[r] as unknown as string[]) at[2].add(code);
			sum.set(key, at);
		}
	for (const { year, v, tier, mass, countries } of whole)
		for (let r = 0; r < v.length; r++) {
			const key = `${year[r]} ${v[r]}`;
			const at = sum.get(key);
			sum.delete(key);
			if (
				at?.[0] !== tier[r] ||
				at[1] !== mass[r] ||
				[...at[2]].sort().join() !== countries[r].join()
			)
				wrong++;
		}
	return wrong + sum.size;
};

const near = (a: number, b: number) => Math.abs(a - b) <= 5.1e-5;

type Fit = { view: string; slope: number; n: number };
type Top = Record<"count" | "authors" | "expected" | "excess", number> & {
	name: string;
};

const meta = await site.load();
const about: { scaling: { rows: Fit[]; top: Top[] } } =
	await Bun.file(aboutPath).json();
const release = await disk<{ years: number[]; default_years: number[] }>(
	"../index.json",
);
let failed = false;

const agreed =
	JSON.stringify([bounds, defaults]) ===
	JSON.stringify([release.years, release.default_years]);
console.log(
	`years ${bounds.join("-")} defaults ${defaults.join("-")}: ${agreed ? "as in index.json" : "not as in index.json"}`,
);
if (!agreed) failed = true;

const keyed = new Map(
	[...meta.nodes.values()].map((node) => [
		node.id ? `${node.level}/${node.id}` : "all",
		node,
	]),
);
const width = defaults[1] - defaults[0] + 1;
for (const row of about.scaling.rows) {
	const key = row.view;
	const node = keyed.get(key);
	if (!node) throw new Error(`view ${key}`);
	site.forget(`views/${node.level}/${node.id}`);
	const [counts, faculty] = await Promise.all([
		site.ends(node, "counts", "n", defaults, true, { tier: [1] }),
		site.ends(node, "faculty", "f", defaults, true),
	]);
	const sums = site.count(counts, [], site.topics(node, []), new Set(), size);
	const people = site.tally(faculty, size, "f", new Set());
	const { expected, beta = Number.NaN } = site.fit(sums, people);
	const n = people.filter((f) => f > 0).length;
	let wrong = Number(!near(beta, row.slope)) + Number(n !== row.n);
	if (key === "all") {
		const top = tables.rank(
			tables.listing(meta, sums, people, expected, width, () => true),
			(row) => row.excess,
			(a, b) => tables.collate(a.name, b.name),
		);
		about.scaling.top.forEach((want, k) => {
			const got = top[k];
			if (
				got?.name !== want.name ||
				!near(got.count / 1e6, want.count) ||
				!near(got.authors / 1e6, want.authors) ||
				!near(expected[got.i] / 1e6, want.expected) ||
				!near(got.excess / 1e6, want.excess)
			)
				wrong++;
		});
	}
	console.log(
		`${key} at the defaults: beta ${beta.toFixed(4)}, n ${n}, mismatches with about.json ${wrong}`,
	);
	if (wrong) failed = true;
}

for (const [view, from, to, tiers, flipping, unchecking] of selections) {
	const node = meta.nodes.get(view);
	if (!node) throw new Error(`view ${view}`);
	const base = `views/${node.level}/${node.id}`;
	site.forget(base);
	const years = tables.span(from, to);
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
	const level = levels.indexOf(node.level);
	const split = node.children.length > 0;
	const columns = ["year", "v", "tier", "mass", "countries"];
	const [whole, apart] = split
		? await Promise.all([
				site.stalls(node, years, true, columns),
				site.stalls(node, years, false, ["child", ...columns]),
			])
		: [cells, []];
	const massed = flip.filter((key, j) => {
		const [, v] = shelf.mass.get(key) as number[];
		const { files } = bundles[j];
		const held = new Set<number>(files.map((group) => group.year[0]));
		return !same(
			masses(files, children(view, level), split),
			stored([...whole, ...apart], v, held),
		);
	}).length;
	const summed = split
		? (await totals(node, [from, to], tiers)) + unions(whole, apart)
		: 0;
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
	console.log(
		`${label}: total ${total}, mismatches ${wrong}, flipped venue masses off ${massed}, child sums off ${summed}`,
	);
	if (wrong || total <= 0 || massed || summed) failed = true;
}

const fonts = await import("./src/poster/fonts");
const noto = await import("./src/poster/noto");
const { clean } = await import("./src/poster/format");
const font = (file: string) =>
	Bun.file(`${import.meta.dir}/public/fonts/${file}`).arrayBuffer();
await fonts.load(font);
const names = [
	...(await disk<{ name: string[] }>("institutions.json")).name,
	...(await disk<{ name: string[] }>("venues.json")).name,
	...[tree.domains, tree.fields, tree.subfields, tree.topics].flatMap((rows) =>
		rows.map((row) => row[1]),
	),
].map(clean);
await noto.prepare(
	names,
	font,
	(file) =>
		new Uint8Array(readFileSync(`${import.meta.dir}/public/fonts/${file}`))
			.buffer,
);
const lacking = new Map<string, number>();
for (const name of names)
	for (const cluster of noto.uncovered(name, { family: "cond", weight: 400 }))
		if (!/^\p{Co}+$/u.test(cluster))
			lacking.set(cluster, (lacking.get(cluster) ?? 0) + 1);
const unmapped = noto
	.files()
	.flatMap(({ codes, face }) => [...codes].filter((c) => !face.glyphs.has(c)));
const points = (text: string) =>
	[...text].map((c) => `U+${(c.codePointAt(0) as number).toString(16)}`);
console.log(
	`fonts: ${names.length} names, ${noto.files().length} Noto files, lacking ${[...lacking].map(([c, n]) => `${points(c).join("+")} in ${n}`).join(", ") || "none"}, unmapped ${unmapped.length}`,
);
if (lacking.size || unmapped.length) failed = true;

server.stop();
if (failed) process.exit(1);
