import type { poster } from "./data";
import { continentOf, familyOrder, nobody, painter } from "./palette";

export type Data = Awaited<ReturnType<typeof poster>>;
export type Institution = Data["institutions"][number];
export type Nation = Data["countries"][number];
export type Venue = Data["venues"][number];
export type Child = Data["children"][number];

export const halves = [1, 2, 3, 4];

export const cut = (values: number[], total: number) => {
	let run = 0;
	const marks: { k: number; row: number }[] = [];
	let end = values.length;
	for (const [i, v] of values.entries()) {
		run += v;
		for (const k of halves) {
			if (marks.some((m) => m.k === k)) continue;
			if ((total - run) * 2 ** k <= total) marks.push({ k, row: i + 1 });
		}
		if ((total - run) * 16 <= total) {
			end = i + 1;
			break;
		}
	}
	return { end, marks };
};

export const derive = (data: Data) => {
	const nations = data.countries.filter((c) => c.count > 0);
	const pool =
		nations.reduce((a, c) => a + c.count, 0) + (data.others?.count ?? 0);
	const nationCut = cut(
		nations.map((c) => c.count),
		pool,
	);
	const listed = nations.slice(0, nationCut.end);
	const paint = painter(data.order);
	const colour = (code: string) => (code ? paint(code) : nobody);
	const continent = (code: string) =>
		code ? (continentOf.get(code) ?? "") : "";
	const tail = nations.slice(nationCut.end);
	const tailContinents = familyOrder.filter((f) =>
		tail.some((c) => c.code && continent(c.code) === f),
	);
	const shown = familyOrder.filter((f) =>
		data.institutions.some((r) => r.country && continent(r.country) === f),
	);

	const mass = data.venues.reduce((a, v) => a + v.count, 0);
	const venueCut = cut(
		data.venues.map((v) => v.count),
		mass,
	);

	const children = data.children;
	const total = data.institutions.reduce((a, r) => a + r.count, 0);

	return {
		nations,
		pool,
		nationCut,
		listed,
		tail,
		tailContinents,
		shown,
		colour,
		continent,
		mass,
		venueCut,
		children,
		total,
	};
};

export type Derived = ReturnType<typeof derive>;
