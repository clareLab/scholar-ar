import {
	type AsyncBuffer,
	asyncBufferFromUrl,
	type FileMetaData,
	parquetMetadataAsync,
	parquetRead,
} from "hyparquet";
import { decompressZstd } from "hyparquet-compressors";

type Level = "all" | "domain" | "field" | "subfield" | "topic";

export type Node = {
	id: number;
	name: string;
	level: Level;
	parent?: Node;
	children: Node[];
};

type Branch = [number, string, number];

type Tree = {
	domains: [number, string][];
	fields: Branch[];
	subfields: Branch[];
	topics: Branch[];
};

type Institutions = {
	id: number[];
	name: string[];
	country: string[];
};

type Venues = { id: number[]; name: string[]; country: string[] };

export type People = { a: number[]; name: string[] };

export type Meta = {
	nodes: Map<number, Node>;
	institutions: Institutions;
	venues: Venues;
};

export type Group = Record<string, number[] & number[][]>;

export const api = import.meta.env.VITE_API as string;

export const years = [2004, 2025];

export const defaults = [2022, 2025];

const memo = new Map<string, Promise<unknown>>();

const once = <T>(key: string, make: () => Promise<T>) => {
	let hit = memo.get(key);
	if (!hit) {
		hit = make();
		memo.set(key, hit);
		hit.catch(() => memo.delete(key));
	}
	return hit as Promise<T>;
};

export const forget = (view: string) => {
	for (const key of memo.keys())
		if (key.startsWith("views/") && !key.startsWith(`${view}/`))
			memo.delete(key);
};

const json = <T>(path: string) =>
	once(path, () =>
		fetch(`${api}/${path}`).then((r) => (r.ok ? r.json() : undefined)),
	) as Promise<T | undefined>;

type Part = { file: AsyncBuffer; metadata: FileMetaData };

const open = (path: string) =>
	once(`${path}#`, async (): Promise<Part | undefined> => {
		const url = `${api}/${path}`;
		const head = await fetch(url, { headers: { Range: "bytes=0-0" } });
		if (head.status === 404) return undefined;
		if (!head.ok) throw new Error(`${head.status} ${path}`);
		const byteLength = Number(head.headers.get("Content-Range")?.split("/")[1]);
		const file = await asyncBufferFromUrl({ url, byteLength });
		const metadata = await parquetMetadataAsync(file, {
			initialFetchSize: 32768,
		});
		return { file, metadata };
	});

const compressors = { ZSTD: (input: Uint8Array) => decompressZstd(input) };

const plain = (value: unknown): unknown =>
	typeof value === "bigint" ? Number(value) : value;

type Stat = (name: string) => [number, number];

export const starts = async (path: string) => {
	const part = await open(path);
	const out = [0];
	for (const group of part?.metadata.row_groups ?? [])
		out.push(out[out.length - 1] + Number(group.num_rows));
	return out;
};

export const read = <T = Group>(path: string, k: number, names?: string[]) =>
	once(`${path}@${k} ${names}`, async () => {
		const part = await open(path);
		if (!part) return undefined;
		const { file, metadata } = part;
		const at = (await starts(path))[k];
		const rows = Number(metadata.row_groups[k].num_rows);
		const columns: Record<string, unknown[]> = {};
		await parquetRead({
			file,
			metadata,
			rowStart: at,
			rowEnd: at + rows,
			columns: names,
			compressors,
			onChunk: ({ columnName, columnData, rowStart, rowEnd }) => {
				columns[columnName] ??= Array(rows);
				const column = columns[columnName];
				const from = Math.max(rowStart, at);
				const to = Math.min(rowEnd, at + rows);
				for (let r = from; r < to; r++)
					column[r - at] = plain(columnData[r - rowStart]);
			},
		});
		return columns as T;
	});

export const groups = async <T = Group>(
	path: string,
	keep: (stat: Stat) => boolean,
	names?: string[],
) => {
	const part = await open(path);
	if (!part) return [];
	const out: Promise<T | undefined>[] = [];
	part.metadata.row_groups.forEach((group, k) => {
		const stat = (name: string): [number, number] => {
			const found = group.columns.find(
				(c) => c.meta_data?.path_in_schema[0] === name,
			)?.meta_data?.statistics;
			return [Number(found?.min_value), Number(found?.max_value)];
		};
		if (keep(stat)) out.push(read<T>(path, k, names));
	});
	return (await Promise.all(out)) as T[];
};

export const having = (want: Record<string, number[]>) => (stat: Stat) =>
	Object.entries(want).every(([name, values]) =>
		values.includes(stat(name)[0]),
	);

const grow = (tree: Tree) => {
	const root: Node = { id: 0, name: "All", level: "all", children: [] };
	const nodes = new Map([[0, root]]);
	const add = (level: Level, rows: (Branch | [number, string])[]) => {
		for (const [id, name, up = 0] of rows) {
			const parent = nodes.get(up) ?? root;
			const node = { id, name, level, parent, children: [] };
			parent.children.push(node);
			nodes.set(id, node);
		}
	};
	add("domain", tree.domains);
	add("field", tree.fields);
	add("subfield", tree.subfields);
	add("topic", tree.topics);
	return nodes;
};

export const load = async (): Promise<Meta> => {
	const [tree, institutions, venues] = await Promise.all([
		json<Tree>("tree.json"),
		json<Institutions>("institutions.json"),
		json<Venues>("venues.json"),
	]);
	if (!tree || !institutions || !venues) throw new Error(api);
	return { nodes: grow(tree), institutions, venues };
};

export const leaves = <T extends { children: T[] }>(twig: T): T[] =>
	twig.children.length ? twig.children.flatMap(leaves) : [twig];

export const topics = (node: Node, off: number[]) => {
	const under = new Map<number, number>();
	if (!node.children.length) under.set(node.id, node.id);
	for (const child of node.children) {
		if (off.includes(child.id)) continue;
		for (const leaf of leaves(child)) under.set(leaf.id, child.id);
	}
	return under;
};

const add = (sums: Map<number, number>, key: number, n: number) =>
	sums.set(key, (sums.get(key) ?? 0) + n);

const split = (topic: number[], k: number[], under: Map<number, number>) => {
	const parts = new Map<number, number>();
	for (let j = 0; j < topic.length; j++) {
		const child = under.get(topic[j]);
		if (child !== undefined) add(parts, child, k[j]);
	}
	return parts;
};

export const credit = (
	files: Group[],
	under: Map<number, number>,
	who: string,
	counted: (row: number, group: Group) => boolean,
	sums: Float64Array,
	sign = 1,
	by?: (group: Group, row: number, id: number) => number,
) => {
	for (const group of files) {
		const { K, topics, k, w } = group;
		const ids = group[who];
		for (let r = 0; r < K.length; r++) {
			if (!counted(r, group)) continue;
			for (const [, kc] of split(topics[r], k[r], under)) {
				for (let j = 0; j < ids[r].length; j++) {
					const at = by ? by(group, r, ids[r][j]) : ids[r][j];
					if (at >= 0)
						sums[at] += sign * Math.round((kc * w[r][j]) / (K[r] * 1000));
				}
			}
		}
	}
	return sums;
};

export const whole = (node: Node, off: Set<number>) =>
	node.children.length > 0 && node.children.every((c) => !off.has(c.id));

export const ends = (
	node: Node,
	file: string,
	key: string,
	[from, to]: number[],
	all: boolean,
	want = {},
) => {
	const split = node.children.length > 0 && !all;
	const names = split ? ["child", "i", key] : ["i", key];
	const path = `views/${node.level}/${node.id}/${file}.parquet`;
	return Promise.all(
		[to, from - 1].map((year) =>
			groups(
				path,
				(stat) =>
					having({ ...want, year: [year] })(stat) &&
					(!node.children.length || (stat("child")[0] === 0) === all),
				names,
			),
		),
	);
};

export const stalls = (
	node: Node,
	years: number[],
	all: boolean,
	names = node.children.length && !all
		? ["year", "child", "v", "tier", "mass"]
		: ["year", "v", "tier", "mass"],
) =>
	groups(
		`views/${node.level}/${node.id}/venues.parquet`,
		(stat) =>
			having({ year: years })(stat) &&
			(!node.children.length || (stat("child")[0] === 0) === all),
		names,
	);

export const tally = (
	[up, down]: Group[][],
	size: number,
	key: string,
	off: Set<number>,
) => {
	const sums = new Float64Array(size);
	for (const [files, sign] of [
		[up, 1],
		[down, -1],
	] as const)
		for (const { child, i, [key]: value } of files)
			for (let r = 0; r < i.length; r++)
				if (!child || !off.has(child[r])) sums[i[r]] += sign * value[r];
	return sums;
};

export const slot = (v: number, year: number) => v * 4096 + year;

export const shelve = (cells: Group[], ids: number[]) => {
	const tier = new Map<number, number>();
	const mass = new Map<string, [number, number, number]>();
	for (const { year, v, tier: t, mass: m } of cells) {
		for (let r = 0; r < v.length; r++) {
			tier.set(slot(v[r], year[r]), t[r]);
			const key = `${t[r]}.${ids[v[r]]}`;
			const cell = mass.get(key) ?? [t[r], v[r], 0];
			cell[2] += m[r];
			mass.set(key, cell);
		}
	}
	const listings = [1, 2, 3, 4].map(
		(): { key: string; tier: number; v: number }[] => [],
	);
	for (const [key, [t, v]] of [...mass].sort(
		(a, b) => b[1][2] - a[1][2] || a[1][1] - b[1][1],
	))
		listings[t - 1].push({ key, tier: t, v });
	return { tier, mass, listings };
};

export type Shelf = ReturnType<typeof shelve>;

export const bundle = (v: number, years: number[]) =>
	groups(`venue/${v}.parquet`, having({ year: years }));

export const swaps = (
	shelf: Shelf,
	flip: string[],
	chosen: Set<number>,
	span: number[],
) =>
	flip
		.filter((key) => shelf.mass.has(key))
		.map((key) => {
			const [t, v] = shelf.mass.get(key) as [number, number, number];
			return {
				key: `${v} ${t}`,
				sign: chosen.has(t) ? -1 : 1,
				read: () =>
					bundle(
						v,
						span.filter((year) => shelf.tier.get(slot(v, year)) === t),
					),
			};
		});

export const count = (
	counts: Group[][],
	bundles: { sign: number; files: Group[] }[],
	under: Map<number, number>,
	off: Set<number>,
	size: number,
) => {
	const sums = tally(counts, size, "n", off);
	for (const { sign, files } of bundles)
		credit(files, under, "i", () => true, sums, sign);
	return sums;
};

export const expect = (counts: Float64Array, people: Float64Array) => {
	const index: number[] = [];
	const logs: number[] = [];
	let total = 0;
	let weighted = 0;
	for (let i = 0; i < counts.length; i++) {
		if (people[i] <= 0) continue;
		const l = Math.log(people[i]);
		index.push(i);
		logs.push(l);
		total += counts[i];
		weighted += counts[i] * l;
	}
	const out = new Float64Array(counts.length);
	if (!total) return out;
	let low = Number.POSITIVE_INFINITY;
	let high = Number.NEGATIVE_INFINITY;
	for (const l of logs) {
		low = Math.min(low, l);
		high = Math.max(high, l);
	}
	const weights = (beta: number) => {
		const shift = beta * (beta > 0 ? high : low);
		return logs.map((l) => Math.exp(beta * l - shift));
	};
	const mean = (beta: number) => {
		const w = weights(beta);
		let sum = 0;
		let at = 0;
		w.forEach((x, k) => {
			sum += x;
			at += x * logs[k];
		});
		return at / sum;
	};
	let lo = -16;
	let hi = 16;
	for (let k = 0; k < 64; k++) {
		const mid = (lo + hi) / 2;
		if (mean(mid) < weighted / total) lo = mid;
		else hi = mid;
	}
	const w = weights((lo + hi) / 2);
	const sum = w.reduce((a, x) => a + x, 0);
	w.forEach((x, k) => {
		out[index[k]] = (total * x) / sum;
	});
	return out;
};

export const hundredths = (num: number, den: number) =>
	(Math.round((100 * num) / den) / 100).toFixed(2);

export const micro = (n: number) => hundredths(n, 1e6);
