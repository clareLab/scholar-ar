import { continents } from "../continents";
import {
	years as bounds,
	count,
	defaults,
	ends,
	expect,
	type Group,
	groups,
	having,
	type Meta,
	type Node,
	shelve,
	stalls,
	swaps,
	tally,
	topics,
	whole,
} from "../data";

import { nation } from "./format";

const depth = 8;
const shortlist = 4;

export type Selection = {
	view: number;
	from: number;
	to: number;
	tiers: number[];
	flip: string[];
	off: number[];
	at: string[];
};

export const origin = "https://ar.clarelab.moe";

export const lands = (meta: Meta) => {
	const seen = new Set([...meta.institutions.country, ...meta.venues.country]);
	return continents
		.flatMap(([, codes]) => codes.split(" "))
		.filter((code) => seen.has(code))
		.sort();
};

const places = (meta: Meta, at: string[]) => {
	const present = new Set(lands(meta));
	const picked = new Set(at);
	const named: string[] = [];
	const covered = new Set<string>();
	for (const [name, codes] of continents) {
		const here = codes.split(" ").filter((code) => present.has(code));
		if (!here.length || !here.every((code) => picked.has(code))) continue;
		named.push(name);
		for (const code of here) covered.add(code);
	}
	return [...named, ...at.filter((code) => !covered.has(code)).map(nation)];
};

const slug = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const address = (meta: Meta, node: Node, s: Selection) => {
	const query: string[] = [];
	const stem = [
		`allrankings${node.id ? `-${node.id}` : ""}-${slug(node.name)}`,
	];
	const listed = (key: string, values: (string | number)[]) => {
		query.push(`${key}=${values.join(",")}`);
		stem.push(
			`${key}-${values.length > 4 ? values.length : values.map((v) => slug(`${v}`)).join("-")}`,
		);
	};
	if (s.from !== defaults[0]) query.push(`from=${s.from}`);
	if (s.to !== defaults[1]) query.push(`to=${s.to}`);
	if (s.from !== defaults[0] || s.to !== defaults[1])
		stem.push(`${s.from}-${s.to}`);
	if (s.tiers.join("") !== "1") {
		query.push(`tiers=${s.tiers.join("")}`);
		stem.push(`t${s.tiers.join("")}`);
	}
	if (s.flip.length) listed("flip", s.flip);
	if (s.off.length) listed("off", s.off);
	if (s.at.length !== lands(meta).length) listed("in", s.at);
	const path = `/${node.id ? `${node.id}/` : ""}institutions/`;
	return {
		url: `${origin}${path}${query.length ? `?${query.join("&")}` : ""}`,
		stem: stem.join("-"),
	};
};

const span = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, k) => from + k);

const rank = <T extends { rank: number }>(
	rows: T[],
	key: (row: T) => number,
	tie: (a: T, b: T) => number,
) => {
	rows.sort((a, b) => key(b) - key(a) || tie(a, b));
	rows.forEach((row, k) => {
		row.rank = k && key(row) === key(rows[k - 1]) ? rows[k - 1].rank : k + 1;
	});
	return rows;
};

const curve = (sums: Float64Array, people: Float64Array, size: number) => {
	const expected = expect(sums, people);
	let low = -1;
	let high = -1;
	let total = 0;
	for (let i = 0; i < people.length; i++) {
		if (people[i] <= 0) continue;
		total += sums[i];
		if (low < 0 || people[i] < people[low]) low = i;
		if (high < 0 || people[i] > people[high]) high = i;
	}
	const beta =
		Math.log(expected[high] / expected[low]) /
		Math.log(people[high] / people[low]);
	const authors = people[high] / size / 1e6;
	const scale = expected[high] / 1e6 / authors ** beta;
	return { expected, beta, total, scale };
};

const bundles = (
	shelf: ReturnType<typeof shelve>,
	s: Selection,
	years: number[],
) =>
	Promise.all(
		swaps(shelf, s.flip, new Set(s.tiers), years).map(
			async ({ sign, read }) => ({ sign, files: await read() }),
		),
	);

const credited = async (
	meta: Meta,
	node: Node,
	shelf: ReturnType<typeof shelve>,
	s: Selection,
	off: Set<number>,
) => {
	const years = span(s.from, s.to);
	const all = whole(node, off);
	const size = meta.institutions.id.length;
	const [counts, faculty, swapped] = await Promise.all([
		ends(node, "counts", "n", [s.from, s.to], all, { tier: [...s.tiers] }),
		ends(node, "faculty", "f", [s.from, s.to], all),
		bundles(shelf, s, years),
	]);
	const sums = count(counts, swapped, topics(node, [...off]), off, size);
	const people = tally(faculty, size, "f", off);
	return { sums, people, ...curve(sums, people, years.length) };
};

const presence = (node: Node, years: number[], all: boolean) =>
	groups(
		`views/${node.level}/${node.id}/venues.parquet`,
		(stat) =>
			having({ year: years })(stat) &&
			(!node.children.length || (stat("child")[0] === 0) === all),
		["countries"],
	);

export const poster = async (meta: Meta, s: Selection) => {
	const { nodes, institutions, venues } = meta;
	const node = nodes.get(s.view) as Node;
	const years = span(s.from, s.to);
	const history = span(bounds[0], bounds[1]);
	const chosen = new Set(s.tiers);
	const flips = new Set(s.flip);
	const off = new Set(s.off);
	const every = s.at.length === lands(meta).length;
	const at = new Set(s.at);
	const land = (code: string) => every || at.has(code);
	const picked = (t: number, v: number) =>
		chosen.has(t) !== flips.has(`${t}.${venues.id[v]}`);
	const size = institutions.id.length;
	const all = whole(node, off);
	const empty = node.children.every((child) => off.has(child.id));

	const cells = await stalls(node, years, true);
	const shelf = shelve(cells, venues.id);
	const past = shelve(
		s.flip.length ? await stalls(node, history, true) : [],
		venues.id,
	);
	const merged = !node.children.length || all;
	const wares: Group[] = merged
		? cells
		: empty
			? []
			: await stalls(node, years, false);
	const marked: Group[] = merged
		? await presence(node, years, true)
		: empty
			? []
			: await presence(node, years, false);

	const main = await credited(meta, node, shelf, s, off);

	const under = topics(node, [...off]);
	const yearly = await Promise.all(
		history.map(async (year) => {
			const [counts, swapped] = await Promise.all([
				ends(node, "counts", "n", [year, year], all, { tier: [...s.tiers] }),
				bundles(past, s, [year]),
			]);
			return count(counts, swapped, under, off, size);
		}),
	);

	const byName = (a: { name: string }, b: { name: string }) =>
		a.name.localeCompare(b.name, "en");

	const listed = (part: Awaited<ReturnType<typeof credited>>) => {
		const rows = [];
		for (let i = 0; i < size; i++) {
			const n = part.sums[i];
			if (n <= 0 || !land(institutions.country[i])) continue;
			rows.push({
				i,
				rank: 0,
				name: institutions.name[i],
				n,
				people: part.people[i],
				e: part.expected[i],
			});
		}
		return rank(rows, (row) => row.n - row.e, byName);
	};

	const rows = listed(main);
	const countRank = new Map(
		rank(
			rows.map((row) => ({ ...row })),
			(row) => row.n,
			byName,
		).map((row) => [row.i, row.rank]),
	);
	const institutionRows = rows.map((row) => ({
		id: institutions.id[row.i],
		name: row.name,
		country: institutions.country[row.i],
		count: row.n,
		authors: row.people / years.length,
		per: row.people
			? Math.round((100 * (row.n * years.length)) / row.people)
			: 0,
		excess: row.n - row.e,
		expected: row.e,
		rankExcess: row.rank,
		rankCount: countRank.get(row.i) as number,
		yearly: yearly.map((sums) => sums[row.i]),
	}));

	const totals = yearly.map((sums) => sums.reduce((a, x) => a + x, 0));
	type Bucket = {
		institutions: number;
		n: number;
		excess: number;
		yearly: number[];
	};
	const bucket = (): Bucket => ({
		institutions: 0,
		n: 0,
		excess: 0,
		yearly: history.map(() => 0),
	});
	const nations = new Map<string, Bucket>();
	const rest = bucket();
	let pool = 0;
	for (let i = 0; i < size; i++) {
		const code = institutions.country[i];
		const n = main.sums[i];
		const touched = n > 0 || yearly.some((sums) => sums[i] > 0);
		if (!touched) continue;
		let into = rest;
		if (land(code)) {
			into = nations.get(code) ?? bucket();
			nations.set(code, into);
		}
		if (n > 0) {
			into.institutions++;
			into.n += n;
			into.excess += n - main.expected[i];
			pool += n;
		}
		yearly.forEach((sums, k) => {
			into.yearly[k] += sums[i];
		});
	}
	const shares = (b: Bucket) => ({
		count: b.n,
		share: pool ? b.n / pool : 0,
		yearly: b.yearly,
		shares: b.yearly.map((n, k) => (totals[k] ? n / totals[k] : 0)),
	});
	const countries = rank(
		[...nations].map(([code, b]) => ({ code, rank: 0, ...b })),
		(row) => row.n,
		(a, b) => a.code.localeCompare(b.code, "en"),
	).map((row) => ({
		code: row.code,
		rank: row.rank,
		institutions: row.institutions,
		excess: row.excess,
		...shares(row),
	}));
	const others = every
		? null
		: { institutions: rest.institutions, ...shares(rest) };

	const hosts = new Map<string, number>();
	for (const code of institutions.country)
		if (code) hosts.set(code, (hosts.get(code) ?? 0) + 1);
	const order = [...hosts]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))
		.map(([code]) => code);

	type Stock = { v: number; n: number; rank: number; tiers: string[] };
	const stocks = new Map<number, Stock>();
	const seen = new Set<number>();
	for (const [k, { year, child, v, tier: t, mass }] of wares.entries()) {
		const reach = marked[k].countries as unknown as string[][];
		for (let r = 0; r < v.length; r++) {
			if (child && off.has(child[r])) continue;
			let row = stocks.get(v[r]);
			if (!row) {
				row = { v: v[r], n: 0, rank: 0, tiers: years.map(() => "") };
				stocks.set(v[r], row);
			}
			row.tiers[year[r] - s.from] = `${t[r]}`;
			if (!picked(t[r], v[r])) continue;
			row.n += mass[r];
			if (reach[r].some(land)) seen.add(v[r]);
		}
	}
	const stock = rank(
		[...stocks.values()].filter((row) => row.n > 0 && seen.has(row.v)),
		(row) => row.n,
		(a, b) => venues.name[a.v].localeCompare(venues.name[b.v], "en"),
	);
	const lore: Group[] = merged
		? await stalls(node, history, true)
		: empty
			? []
			: await stalls(node, history, false);
	const before = new Map<number, string[]>();
	for (const { year, child, v, tier: t } of lore)
		for (let r = 0; r < v.length; r++) {
			if (child && off.has(child[r])) continue;
			const row = before.get(v[r]) ?? history.map(() => "");
			row[year[r] - history[0]] = `${t[r]}`;
			before.set(v[r], row);
		}
	const mass = stock.reduce((a, row) => a + row.n, 0);
	const runs: number[] = [];
	stock.forEach((row, k) => {
		runs.push((runs[k - 1] ?? 0) + row.n);
	});
	const venueRows = stock.map((row) => ({
		id: venues.id[row.v],
		rank: row.rank,
		name: venues.name[row.v],
		country: venues.country[row.v],
		tiers: row.tiers,
		past: before.get(row.v) ?? history.map(() => ""),
		count: row.n,
	}));
	const marks: { k: number; row: number }[] = [];
	for (let k = 1; k <= depth; k++) {
		const reach = runs.findIndex((run) => (mass - run) * 2 ** k <= mass);
		if (reach < 0 || reach >= runs.length - 1) break;
		const last = marks[marks.length - 1];
		if (last?.row === reach + 1) last.k = k;
		else marks.push({ k, row: reach + 1 });
	}

	const topical = async (child: Node) => {
		const [up, down] = await ends(child, "counts", "n", [s.from, s.to], false, {
			tier: [...s.tiers],
		});
		const sums = new Map<number, number>();
		for (const [files, sign] of [
			[up, 1],
			[down, -1],
		] as const)
			for (const { child: g, i, n } of files)
				for (let r = 0; r < i.length; r++)
					if (land(institutions.country[i[r]]))
						sums.set(g[r], (sums.get(g[r]) ?? 0) + sign * n[r]);
		return child.children
			.map((g) => ({ id: g.id, name: g.name, count: sums.get(g.id) ?? 0 }))
			.filter((g) => g.count > 0)
			.sort((a, b) => b.count - a.count || a.id - b.id);
	};

	const checked = node.children.filter((child) => !off.has(child.id));
	const parts = await Promise.all(
		checked.map(async (child) => {
			const only = new Set(
				node.children.filter((c) => c !== child).map((c) => c.id),
			);
			const part = await credited(meta, node, shelf, s, only);
			const leaders = listed(part);
			return {
				id: child.id,
				name: child.name,
				count: leaders.reduce((a, row) => a + row.n, 0),
				grandchildren: child.children.length ? await topical(child) : [],
				leaders: leaders.slice(0, shortlist).map((row) => ({
					id: institutions.id[row.i],
					name: row.name,
					country: institutions.country[row.i],
					rank: row.rank,
					count: row.n,
					excess: row.n - row.e,
				})),
			};
		}),
	);
	const children = parts
		.filter((part) => part.count > 0)
		.sort((a, b) => b.count - a.count || a.id - b.id);
	const zero = parts
		.filter((part) => part.count <= 0)
		.map((part) => ({ id: part.id, name: part.name }));

	const trail: string[] = [];
	for (let up = node.parent; up?.parent; up = up.parent) trail.unshift(up.name);

	return {
		view: { id: node.id, name: node.name, level: node.level, trail },
		...address(meta, node, s),
		selection: {
			...s,
			years,
			at: every ? null : s.at,
			places: every ? null : places(meta, s.at),
		},
		levels: {
			child: node.children[0]?.level ?? null,
			grandchild:
				node.children.flatMap((child) => child.children)[0]?.level ?? null,
			total: node.children.length,
		},
		history,
		order,
		kpi: {
			institutions: institutionRows.length,
			countries: countries.filter((c) => c.code && c.institutions > 0).length,
			venues: venueRows.length,
			years: [s.from, s.to],
			tiers: s.tiers,
		},
		model: {
			beta: main.beta,
			total: main.total,
			scale: main.scale,
		},
		institutions: institutionRows,
		countries,
		others,
		venues: venueRows,
		marks,
		children,
		zero,
	};
};
