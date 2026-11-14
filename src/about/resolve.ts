import type { Lang } from "./words/index.ts";

type Pair = [number, number];
type View = string;
type Venue = {
	name: string;
	rank: number;
	phi: number;
	mass: number;
	tier: number;
};
type Ranked = { view: View; name: string; share: number };
type Slope = {
	view: View;
	name: string;
	slope: number;
	intercept: number;
	n: number;
};

export type About = {
	release: string;
	snapshot: string;
	years: Pair;
	default_years: Pair;
	corpus: {
		papers: number;
		venues: number;
		institutions: number;
		people: number;
		people_orcid: number;
		references: number;
		levels: {
			domains: number;
			fields: number;
			subfields: number;
			topics: number;
		};
	};
	names: {
		domains: Record<string, string>;
		fields: Record<string, string>;
		subfields: Record<string, string>;
	};
	example: {
		title: string;
		venue: string;
		year: number;
		references: number;
		K: number;
		topics: {
			topic: number;
			name: string;
			subfield: number;
			field: number;
			domain: number;
			k: number;
		}[];
		largest: {
			topic: number;
			name: string;
			subfield: number;
			field: number;
			domain: number;
			k: number;
		};
		fields: { field: number; name: string; k: number }[];
	};
	tier_example: {
		view: View;
		name: string;
		year: number;
		pool: number;
		mass: number;
		cuts: [number, number, number];
		curve: Pair[];
		lead: Venue;
		heavy: number;
		heavy_share: number;
		named: Venue[];
	};
	composition: { view: View; mass: [number, number, number, number] }[];
	upstream: { top: Ranked[]; bottom: Ranked[] };
	t1: {
		year: number;
		rows: {
			view: View;
			share: number;
			venues: number;
			top: number;
			venue: string;
		}[];
	};
	validity: {
		window: Pair;
		falls: {
			top10: number;
			top1: number;
			fwci: number;
			every: number;
			views: number;
		};
		rows: {
			view: View;
			tier: number;
			mass: number;
			top10: number;
			top1: number;
			fwci: number;
			coverage: number;
		}[];
	};
	concentration: {
		view: View;
		top10: number;
		top100: number;
		gini: number;
		lorenz: Pair[];
	}[];
	countries: {
		years: number[];
		series: { country: string; share: number[] }[];
	};
	scaling: {
		rows: Slope[];
		high: Slope;
		low: Slope;
		top: {
			name: string;
			count: number;
			authors: number;
			expected: number;
			excess: number;
		}[];
		example: {
			view: View;
			points: [string, number, number][];
			bins: {
				lo: number;
				hi: number;
				n: number;
				zeros: number;
				mean: number;
			}[];
		};
	};
};

const number = (value: unknown, path: string) => {
	if (typeof value !== "number" || !Number.isFinite(value))
		throw new Error(`not a number: ${path}`);
	return value;
};

export const grouped = (value: number) =>
	Math.round(value)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const formats: Record<string, (value: unknown, path: string) => string> = {
	int: (value, path) => grouped(number(value, path)),
	pct0: (value, path) => `${(100 * number(value, path)).toFixed(0)}%`,
	pct1: (value, path) => `${(100 * number(value, path)).toFixed(1)}%`,
	d1: (value, path) => number(value, path).toFixed(1),
	d2: (value, path) => number(value, path).toFixed(2),
	raw: (value, path) => {
		if (typeof value === "string") return value;
		return `${number(value, path)}`;
	},
};

const step = (from: unknown, segment: string, path: string) => {
	const [, key, filter] = segment.match(/^([^[\]]+)(?:\[([^\]]+)\])?$/) ?? [];
	if (key === undefined) throw new Error(`bad path: ${path}`);
	const at =
		Array.isArray(from) && /^-\d+$/.test(key)
			? `${from.length + Number(key)}`
			: key;
	if (from === null || typeof from !== "object" || !Object.hasOwn(from, at))
		throw new Error(`unknown path: ${path}`);
	const value = (from as Record<string, unknown>)[at];
	if (filter === undefined) return value;
	if (!Array.isArray(value)) throw new Error(`not a list: ${path}`);
	const want = filter.split(",").map((pair) => pair.split("="));
	const hits = value.filter((item) =>
		want.every(
			([name, wanted]) =>
				item !== null &&
				typeof item === "object" &&
				Object.hasOwn(item, name) &&
				`${item[name]}` === wanted,
		),
	);
	if (hits.length !== 1) throw new Error(`${hits.length} matches: ${path}`);
	return hits[0];
};

const parts = (path: string) => path.match(/(?:[^.[\]]|\[[^\]]*\])+/g) ?? [];

export const pick = (about: About, path: string) =>
	parts(path).reduce<unknown>((at, part) => step(at, part, path), about);

const lists: Record<Lang, (items: string[]) => string> = {
	en: (items) => {
		const [between, last] = items.some((item) => item.includes(","))
			? ["; ", "; and "]
			: [", ", " and "];
		return items.length < 2
			? items.join("")
			: `${items.slice(0, -1).join(between)}${last}${items.at(-1)}`;
	},
	zh: (items) =>
		items.length < 2
			? items.join("")
			: `${items.slice(0, -1).join("、")} 和 ${items.at(-1)}`,
};

const share = (mass: number[]) => mass[0] / mass.reduce((a, b) => a + b, 0);

const claims: [string, (about: About) => boolean][] = [
	[
		"the top 1% share and the mean FWCI fall at every step in all views",
		({ validity: { falls } }) =>
			falls.top1 === falls.views && falls.fwci === falls.views,
	],
	[
		"the top 10% share falls at every step except between the level T2 and T3 of field 18",
		({ validity: { falls, rows } }) => {
			const [t1, t2, t3, t4] = rows
				.filter((row) => row.view === "field/18")
				.sort((a, b) => a.tier - b.tier)
				.map((row) => row.top10);
			return (
				falls.views - falls.top10 === 1 &&
				t1 > t2 &&
				t2 <= t3 &&
				t3 - t2 < 0.005 &&
				t3 > t4
			);
		},
	],
	[
		"beta is above 1 in All",
		({ scaling }) =>
			(scaling.rows.find((row) => row.view === "all")?.slope ?? 0) > 1,
	],
	[
		"scaling.low and scaling.high hold the lowest and highest beta of the fields",
		({ scaling: { rows, low, high } }) => {
			const slopes = rows
				.filter((row) => row.view !== "all")
				.map((row) => row.slope);
			return (
				low.slope === Math.min(...slopes) && high.slope === Math.max(...slopes)
			);
		},
	],
	[
		"the share of the United States fell and the share of China rose over the years",
		({ years, countries }) => {
			const ends = (code: string) => {
				const series = countries.series.find((s) => s.country === code);
				return series ? [series.share[0], series.share.at(-1) ?? 0] : [0, 0];
			};
			const [us0, us1] = ends("US");
			const [cn0, cn1] = ends("CN");
			return (
				countries.years[0] === years[0] &&
				countries.years.at(-1) === years[1] &&
				us1 < us0 &&
				cn1 > cn0
			);
		},
	],
	[
		"upstream names the fields with the largest and smallest T1 shares in order",
		({ composition, upstream }) => {
			const order = composition
				.filter((row) => row.view !== "all")
				.sort(
					(a, b) => share(b.mass) - share(a.mass) || (a.view < b.view ? -1 : 1),
				)
				.map((row) => row.view);
			const top = upstream.top.map((row) => row.view);
			const bottom = upstream.bottom.map((row) => row.view).reverse();
			return (
				`${top}` === `${order.slice(0, top.length)}` &&
				`${bottom}` === `${order.slice(-bottom.length)}`
			);
		},
	],
	[
		"the example paper lies mostly in field 17 and reaches at least three fields in falling order",
		({ example: { K, fields }, tier_example }) =>
			tier_example.view === "field/17" &&
			fields.length >= 3 &&
			fields[0].field === 17 &&
			2 * fields[0].k >= K &&
			fields.every((field, k) => !k || field.k <= fields[k - 1].k),
	],
];

export const resolve = (
	markdown: string,
	about: About,
	lang: Lang,
	extra: Record<string, unknown> = {},
) => {
	for (const [claim, holds] of claims)
		if (!holds(about)) throw new Error(`claim fails: ${claim}`);
	const out = markdown.replace(
		/\{\{([^{}|]+)\|([a-z0-9]+)\}\}/g,
		(_, path: string, format: string) => {
			if (format === "list")
				return lists[lang](
					path.split("+").map((item) => formats.raw(pick(about, item), item)),
				);
			const show = formats[format];
			if (!show) throw new Error(`unknown format: ${format}`);
			return show(path in extra ? extra[path] : pick(about, path), path);
		},
	);
	const left = out.replace(/^```[\s\S]*?^```/gm, "").match(/\{\{[^}]*\}\}?/);
	if (left) throw new Error(`bad placeholder: ${left[0]}`);
	return out;
};
