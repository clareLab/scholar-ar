import { defaults, years } from "virtual:years";
import { type Lang, langs } from "./about/words";
import type { Node } from "./data";

export { defaults, years };

export const origin = "https://ar.clarelab.moe";

export const tiers = [1, 2, 3, 4];

export const sorts = [
	["count", "Count"],
	["authors", "Authors"],
	["ratio", "Per author"],
	["excess", "Excess"],
] as const;

export const means = ["count", "authors", "venues"] as const;

export type Tab = "institutions" | "venues" | "about";
export type Sort = (typeof sorts)[number][0];
export type Mean = (typeof means)[number];

export type Place = { tab: Tab; view: number; lang: Lang };

export type State = {
	view: number;
	from: number;
	to: number;
	tiers: number[];
	flip: string[];
	off: number[];
	at: string[];
	above: Mean[];
	tab: Tab;
	lang: Lang;
	sort: Sort;
	by: "count" | "score";
	inst?: number;
	author?: number;
	venue?: number;
	firm?: number;
};

export type Selection = Pick<
	State,
	"view" | "from" | "to" | "tiers" | "flip" | "off" | "at"
>;

export const parse = (raw: string, nodes: Map<number, Node>) => {
	const path = raw.replace(/\/+/g, "/").replace(/\/index\.html$/, "/");
	const view = path.match(/^\/(?:([1-9]\d*)\/)?(institutions|venues)\/?$/);
	if (view) {
		const id = Number(view[1] ?? 0);
		if (id && !nodes.has(id)) return undefined;
		return { tab: view[2] as Tab, view: id, lang: "en" } as Place;
	}
	const about = path.match(/^\/(\w+)\/about\/?$/);
	const lang = langs.find((key) => key === about?.[1]);
	return lang ? ({ tab: "about", view: 0, lang } as Place) : undefined;
};

export const where = ({ tab, view, lang }: Place) =>
	tab === "about" ? `/${lang}/about/` : `/${view ? `${view}/` : ""}${tab}/`;

const list = (value: string | null) => (value ?? "").split(",").filter(Boolean);

export const read = (
	at: { pathname: string; search: string },
	nodes: Map<number, Node>,
	lands: string[],
): State => {
	const q = new URLSearchParams(at.search);
	const place = parse(at.pathname, nodes) ?? {
		tab: "institutions",
		view: 0,
		lang: "en",
	};
	const int = (key: string, or: number) => {
		const value = Number(q.get(key) || Number.NaN);
		return Number.isInteger(value) ? value : or;
	};
	const id = (tab: Tab, key: string) =>
		place.tab === tab && q.get(key) ? int(key, -1) : undefined;
	const [low, high] = years;
	const clamp = (year: number) => Math.min(Math.max(year, low), high);
	const from = clamp(int("from", defaults[0]));
	return {
		view: place.view,
		from,
		to: Math.max(clamp(int("to", defaults[1])), from),
		tiers: tiers.filter((t) => (q.get("tiers") ?? "1").includes(`${t}`)),
		flip: [
			...new Set(list(q.get("flip")).filter((key) => /^[1-4]\.\d+$/.test(key))),
		],
		off: list(q.get("off")).map(Number),
		at: q.has("in")
			? lands.filter((code) => list(q.get("in")).includes(code))
			: lands,
		above: means.filter((key) => list(q.get("above")).includes(key)),
		tab: place.tab,
		lang: place.lang,
		sort: sorts.find(([key]) => key === q.get("sort"))?.[0] ?? "excess",
		by: q.get("by") === "score" ? "score" : "count",
		inst: id("institutions", "inst"),
		author: id("institutions", "author"),
		venue: id("venues", "venue"),
		firm: id("venues", "inst"),
	};
};

const query = (state: Selection, lands: string[]) => {
	const parts = [];
	if (state.from !== defaults[0]) parts.push(`from=${state.from}`);
	if (state.to !== defaults[1]) parts.push(`to=${state.to}`);
	if (state.tiers.join("") !== "1") parts.push(`tiers=${state.tiers.join("")}`);
	if (state.flip.length) parts.push(`flip=${state.flip.join(",")}`);
	if (state.off.length) parts.push(`off=${state.off.join(",")}`);
	if (state.at.length !== lands.length) parts.push(`in=${state.at.join(",")}`);
	return parts;
};

const join = (path: string, parts: string[]) =>
	path + (parts.length ? `?${parts.join("&")}` : "");

export const url = (state: State, lands: string[]) => {
	const parts = query(state, lands);
	if (state.above.length) parts.push(`above=${state.above.join(",")}`);
	if (state.sort !== "excess") parts.push(`sort=${state.sort}`);
	if (state.by !== "count") parts.push(`by=${state.by}`);
	const keys = {
		institutions: { inst: state.inst, author: state.author },
		venues: { venue: state.venue, inst: state.firm },
		about: {},
	}[state.tab];
	for (const [key, id] of Object.entries(keys))
		if (id !== undefined) parts.push(`${key}=${id}`);
	return join(where(state), parts);
};

export const link = (state: Selection, lands: string[]) =>
	join(
		where({ tab: "institutions", view: state.view, lang: "en" }),
		query(state, lands),
	);

export const selection = (state: Selection): Selection => ({
	view: state.view,
	from: state.from,
	to: state.to,
	tiers: [...state.tiers],
	flip: [...state.flip],
	off: [...state.off].sort((a, b) => a - b),
	at: [...state.at],
});
