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

export type Index = {
	release: string;
	years: [number, number];
	default_years: [number, number];
};

type Tree = {
	domains: [number, string][];
	fields: Branch[];
	subfields: Branch[];
	topics: Branch[];
};

export type Institutions = {
	id: number[];
	name: string[];
	country: string[];
	ror: string[];
};

export type Venues = { id: number[]; name: string[]; country: string[] };

export type People = { a: number[]; name: string[] };

export type Meta = {
	index: Index;
	nodes: Map<number, Node>;
	institutions: Institutions;
	venues: Venues;
};

export type Group = Record<string, number[] & number[][]>;

const api: string =
	import.meta.env.VITE_API || "https://assets.clarelab.moe/allrankings";

const memo = new Map<string, Promise<unknown>>();

const once = <T>(key: string, make: () => Promise<T>) => {
	let hit = memo.get(key);
	if (!hit) {
		hit = make();
		memo.set(key, hit);
	}
	return hit as Promise<T>;
};

export const json = <T>(path: string) =>
	once(path, () =>
		fetch(`${api}/${path}`).then((r) => (r.ok ? r.json() : undefined)),
	) as Promise<T | undefined>;

type Part = { file: AsyncBuffer; metadata: FileMetaData };

const open = (path: string) =>
	once(`${path}#`, async (): Promise<Part | undefined> => {
		try {
			const file = await asyncBufferFromUrl({ url: `${api}/${path}` });
			const metadata = await parquetMetadataAsync(file, {
				initialFetchSize: 8,
			});
			return { file, metadata };
		} catch {
			return undefined;
		}
	});

const compressors = { ZSTD: (input: Uint8Array) => decompressZstd(input) };

const plain = (value: unknown): unknown =>
	typeof value === "bigint" ? Number(value) : value;

export type Stat = (name: string) => [number, number];

export const starts = async (path: string) => {
	const part = await open(path);
	const out = [0];
	for (const group of part?.metadata.row_groups ?? [])
		out.push(out[out.length - 1] + Number(group.num_rows));
	return out;
};

export const read = <T = Group>(path: string, k: number, names?: string[]) =>
	once(`${path}@${k}`, async () => {
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
		if (keep(stat)) out.push(read<T>(path, k));
	});
	return (await Promise.all(out)) as T[];
};

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
	const index = await json<Index>("index.json");
	if (!index) throw new Error("index.json");
	const [tree, institutions, venues] = await Promise.all([
		json<Tree>(`${index.release}/tree.json`),
		json<Institutions>(`${index.release}/institutions.json`),
		json<Venues>(`${index.release}/venues.json`),
	]);
	if (!tree || !institutions || !venues) throw new Error(index.release);
	return { index, nodes: grow(tree), institutions, venues };
};

export const path = (node: Node): Node[] =>
	node.parent ? [...path(node.parent), node] : [node];

const leaves = (node: Node): Node[] =>
	node.children.length ? node.children.flatMap(leaves) : [node];

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
) => {
	for (const group of files) {
		const { K, topics, k, w } = group;
		const ids = group[who];
		for (let r = 0; r < K.length; r++) {
			if (!counted(r, group)) continue;
			for (const [, kc] of split(topics[r], k[r], under)) {
				for (let j = 0; j < ids[r].length; j++)
					sums[ids[r][j]] += sign * Math.round((kc * w[r][j]) / (K[r] * 1000));
			}
		}
	}
	return sums;
};

export const total = (
	files: Group[],
	size: number,
	key: string,
	value: (row: number, group: Group) => number,
) => {
	const sums = new Float64Array(size);
	for (const group of files) {
		const keys = group[key];
		for (let r = 0; r < keys.length; r++) sums[keys[r]] += value(r, group);
	}
	return sums;
};

export const hundredths = (num: number, den: number) =>
	(Math.round((100 * num) / den) / 100).toFixed(2);

export const micro = (n: number) => hundredths(n, 1e6);
