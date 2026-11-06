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
	r2: number;
	n: number;
};

export type About = {
	release: string;
	snapshot: string;
	years: Pair;
	default_years: Pair;
	corpus: {
		papers: number;
		by_year: [number, number, number][];
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
		work: string;
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
	stability: {
		view: View;
		name: string;
		mean: number;
		n: number;
		rho: Pair[];
	}[];
	scaling: {
		rows: Slope[];
		high: Slope;
		low: Slope;
		example: { view: View; points: [string, number, number][] };
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
	d3: (value, path) => number(value, path).toFixed(3),
	raw: (value, path) => {
		if (typeof value === "string") return value;
		return `${number(value, path)}`;
	},
};

const step = (from: unknown, segment: string, path: string) => {
	const [, key, filter] = segment.match(/^([^[\]]+)(?:\[([^\]]+)\])?$/) ?? [];
	if (key === undefined) throw new Error(`bad path: ${path}`);
	if (from === null || typeof from !== "object" || !Object.hasOwn(from, key))
		throw new Error(`unknown path: ${path}`);
	const value = (from as Record<string, unknown>)[key];
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

export const resolve = (
	markdown: string,
	about: About,
	extra: Record<string, unknown> = {},
) => {
	const out = markdown.replace(
		/\{\{([^{}|]+)\|([a-z0-9]+)\}\}/g,
		(_, path, format) => {
			const show = formats[format];
			if (!show) throw new Error(`unknown format: ${format}`);
			return show(path in extra ? extra[path] : pick(about, path), path);
		},
	);
	const left = out.replace(/^```[\s\S]*?^```/gm, "").match(/\{\{[^}]*\}\}?/);
	if (left) throw new Error(`bad placeholder: ${left[0]}`);
	return out;
};
