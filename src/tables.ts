import { continents } from "./continents";
import { count, credit, type Group, type Meta } from "./data";

export const span = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, k) => from + k);

export const collate = new Intl.Collator("en").compare;

export const lands = (meta: Meta) => {
	const seen = new Set(meta.institutions.country);
	return continents
		.flatMap(([, codes]) => codes.split(" "))
		.filter((code) => seen.has(code))
		.sort();
};

export const picker =
	(chosen: Set<number>, flips: Set<string>, ids: number[]) =>
	(t: number, v: number) =>
		chosen.has(t) !== flips.has(`${t}.${ids[v]}`);

export const lander = (at: Set<string>, lands: string[]) => (code: string) =>
	at.size === lands.length || at.has(code);

export const rank = <T extends { rank: number }>(
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

export type Row = {
	i: number;
	rank: number;
	count: number;
	authors: number;
	people: number;
	ratio: number;
	excess: number;
	name: string;
};

export const listing = (
	meta: Meta,
	sums: Float64Array,
	people: Float64Array,
	expected: Float64Array,
	width: number,
	land: (code: string) => boolean,
) => {
	const { institutions } = meta;
	const rows: Row[] = [];
	for (let i = 0; i < institutions.id.length; i++) {
		const n = sums[i];
		if (n <= 0 || !land(institutions.country[i])) continue;
		const sum = people[i];
		const f = sum / width;
		rows.push({
			i,
			rank: 0,
			count: n,
			authors: f,
			people: sum,
			ratio: f ? n / f : 0,
			excess: n - expected[i],
			name: institutions.name[i],
		});
	}
	return rows;
};

export type Stock = {
	v: number;
	n: number;
	rank: number;
	tiers: string[];
	score?: number;
};

export const stock = (
	wares: Group[],
	marks: Group[],
	off: Set<number>,
	years: number[],
	picked: (t: number, v: number) => boolean,
	land: (code: string) => boolean,
	score?: (v: number) => number | undefined,
) => {
	const rows = new Map<number, Stock>();
	const seen = new Set<number>();
	for (const [k, { year, child, v, tier: t, mass }] of wares.entries()) {
		const countries = marks[k].countries as unknown as string[][];
		for (let r = 0; r < v.length; r++) {
			if (child && off.has(child[r])) continue;
			let row = rows.get(v[r]);
			if (!row) {
				const tiers = years.map(() => "");
				row = { v: v[r], n: 0, rank: 0, tiers, score: score?.(v[r]) };
				rows.set(v[r], row);
			}
			row.tiers[year[r] - years[0]] = `${t[r]}`;
			if (!picked(t[r], v[r])) continue;
			row.n += mass[r];
			if (countries[r].some(land)) seen.add(v[r]);
		}
	}
	return [...rows.values()].filter((row) => row.n > 0 && seen.has(row.v));
};

export const firms = (
	meta: Meta,
	files: Group[],
	under: Map<number, number>,
	off: Set<number>,
	land: (code: string) => boolean,
) => {
	const { institutions } = meta;
	const sums = count(
		[[], []],
		[{ sign: 1, files }],
		under,
		off,
		institutions.id.length,
	);
	const rows: { i: number; n: number; rank: number }[] = [];
	sums.forEach((n, i) => {
		if (n > 0 && land(institutions.country[i])) rows.push({ i, n, rank: 0 });
	});
	return rank(
		rows,
		(row) => row.n,
		(a, b) => collate(institutions.name[a.i], institutions.name[b.i]),
	);
};

export const team = (
	crew: Group[],
	under: Map<number, number>,
	counted: (v: number, year: number) => boolean,
	inside: number,
	size: number,
) => {
	const sums = credit(
		crew,
		under,
		"a",
		(r, g) => counted(g.v[r], g.year[r]) && (inside < 0 || g.v[r] === inside),
		new Float64Array(size),
	);
	const rows: { a: number; n: number; rank: number }[] = [];
	sums.forEach((n, a) => {
		if (n > 0) rows.push({ a, n, rank: 0 });
	});
	return rank(
		rows,
		(row) => row.n,
		(a, b) => a.a - b.a,
	);
};

export const paths = (
	meta: Meta,
	crew: Group[],
	under: Map<number, number>,
	counted: (v: number, year: number) => boolean,
	who: number,
) => {
	const { venues } = meta;
	const sums = credit(
		crew,
		under,
		"a",
		(r, g) => counted(g.v[r], g.year[r]),
		new Float64Array(venues.id.length),
		1,
		(g, r, a) => (a === who ? g.v[r] : -1),
	);
	const rows: { v: number; n: number; rank: number }[] = [];
	sums.forEach((n, v) => {
		if (n > 0) rows.push({ v, n, rank: 0 });
	});
	return rank(
		rows,
		(row) => row.n,
		(a, b) => collate(venues.name[a.v], venues.name[b.v]),
	);
};

export const shares = (meta: Meta, sums: Float64Array) => {
	const by = new Map<string, number>();
	let sum = 0;
	sums.forEach((n, i) => {
		if (n <= 0) return;
		const code = meta.institutions.country[i];
		by.set(code, (by.get(code) ?? 0) + n);
		sum += n;
	});
	return { by, sum };
};
