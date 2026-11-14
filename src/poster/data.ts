import { continents } from "../continents";
import {
	count,
	ends,
	fit,
	type Group,
	type Meta,
	type Node,
	shelve,
	stalls,
	swaps,
	tally,
	topics,
	whole,
} from "../data";
import {
	years as bounds,
	defaults,
	link,
	origin,
	type Selection,
} from "../state";
import { lander, lands, listing, picker, rank, span, stock } from "../tables";
import { nation } from "./format";

const shortlist = 4;

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
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const address = (meta: Meta, node: Node, s: Selection) => {
	const stem = [
		`allrankings${node.id ? `-${node.id}` : ""}-${slug(node.name)}`,
	];
	const listed = (key: string, values: (string | number)[]) => {
		stem.push(
			`${key}-${values.length > 4 ? values.length : values.map((v) => slug(`${v}`)).join("-")}`,
		);
	};
	if (s.from !== defaults[0] || s.to !== defaults[1])
		stem.push(`${s.from}-${s.to}`);
	if (s.tiers.join("") !== "1") stem.push(`t${s.tiers.join("")}`);
	if (s.flip.length) listed("flip", s.flip);
	if (s.off.length) listed("off", s.off);
	if (s.at.length !== lands(meta).length) listed("in", s.at);
	return {
		url: `${origin}${link(s, lands(meta))}`,
		stem: stem.join("-"),
	};
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
	return { sums, people, ...fit(sums, people) };
};

export const poster = async (meta: Meta, s: Selection) => {
	const { nodes, institutions, venues } = meta;
	const node = nodes.get(s.view) as Node;
	const years = span(s.from, s.to);
	const history = span(bounds[0], bounds[1]);
	const chosen = new Set(s.tiers);
	const flips = new Set(s.flip);
	const off = new Set(s.off);
	const every = s.at.length === lands(meta).length;
	const land = lander(new Set(s.at), lands(meta));
	const picked = picker(chosen, flips, venues.id);
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
		? await stalls(node, years, true, ["countries"])
		: empty
			? []
			: await stalls(node, years, false, ["countries"]);

	const main = await credited(meta, node, shelf, s, off);

	const byName = (a: { name: string }, b: { name: string }) =>
		a.name.localeCompare(b.name, "en");

	const listed = (part: Awaited<ReturnType<typeof credited>>) =>
		rank(
			listing(meta, part.sums, part.people, part.expected, years.length, land),
			(row) => row.excess,
			byName,
		);

	const rows = listed(main);
	if (!rows.some((row) => row.people > 0)) throw new Error("empty selection");

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

	const countRank = new Map(
		rank(
			rows.map((row) => ({ ...row })),
			(row) => row.count,
			byName,
		).map((row) => [row.i, row.rank]),
	);
	const institutionRows = rows.map((row) => ({
		id: institutions.id[row.i],
		name: row.name,
		country: institutions.country[row.i],
		count: row.count,
		authors: row.authors,
		per: row.people
			? Math.round((100 * (row.count * years.length)) / row.people)
			: 0,
		excess: row.excess,
		expected: main.expected[row.i],
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
		const fitted = main.people[i] > 0;
		const touched = n > 0 || yearly.some((sums) => sums[i] > 0);
		if (!touched && !fitted) continue;
		let into = rest;
		if (land(code)) {
			into = nations.get(code) ?? bucket();
			nations.set(code, into);
		}
		if (fitted) into.excess += n - main.expected[i];
		if (n > 0) {
			into.institutions++;
			into.n += n;
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

	const stocks = rank(
		stock(wares, marked, off, years, picked, land),
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
	const venueRows = stocks.map((row) => ({
		id: venues.id[row.v],
		rank: row.rank,
		name: venues.name[row.v],
		country: venues.country[row.v],
		tiers: row.tiers,
		past: before.get(row.v) ?? history.map(() => ""),
		count: row.n,
	}));

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
				count: leaders.reduce((a, row) => a + row.count, 0),
				grandchildren: child.children.length ? await topical(child) : [],
				leaders: leaders.slice(0, shortlist).map((row) => ({
					id: institutions.id[row.i],
					name: row.name,
					country: institutions.country[row.i],
					rank: row.rank,
					count: row.count,
					excess: row.excess,
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
			tiers: s.tiers,
		},
		model: main.scale
			? { beta: main.beta, scale: main.scale(years.length) }
			: null,
		institutions: institutionRows,
		countries,
		others,
		venues: venueRows,
		children,
		zero,
	};
};
